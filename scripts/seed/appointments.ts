import type { DatabaseClient } from "../../packages/db/src/client.js";
import {
  recordSessionInclude,
  responsibleTeacher,
} from "../../packages/api/src/class-records/data.js";
import { DEV_ADMIN, DEV_TEACHERS } from "../../packages/db/src/seed-dev-data.js";
import { stableUuid } from "../../packages/db/src/seed-dev-support.js";
import {
  SUPPORT_SCENARIOS,
  minutesAfter,
  sourcePlan,
  type AppointmentEnrollment,
  type AppointmentSeedContext,
  type SeedCoverage,
} from "./appointments-data.js";
import { knownLegacySource, scenarioAbsences, scenarioEnrollment } from "./appointments-sources.js";
import {
  appointmentEndedAt,
  cancellationInstant,
  findAppointmentSlot,
  type AppointmentSeedSlot,
} from "./appointments-scheduling.js";
import {
  cancelForRescheduling,
  createScheduledAppointment,
  importUnknownLegacyAppointment,
  recordSeedAppointment,
  type AppointmentDraft,
} from "./appointments-persistence.js";

const STAFF_SELECT = { id: true, name: true, email: true, role: true, isEnabled: true } as const;

/** Part of the single full school reconstruction, after actual class records and declarations exist. */
export async function seedAppointments(database: DatabaseClient, todayIso: string): Promise<void> {
  const staff = await database.user.findMany({
    where: { email: { in: [DEV_ADMIN.email, ...DEV_TEACHERS.map((row) => row.email)] } },
    select: STAFF_SELECT,
  });
  const admin = staff.find((person) => person.email === DEV_ADMIN.email);
  if (!admin) throw new Error("Appointment fixtures require the school administrator.");
  const teachers = staff.filter((person) => person.role === "TEACHER");
  const base = { todayIso, admin, teachers };
  const legacyCount = await database.$transaction(
    (transaction) => seedLegacyAppointments({ ...base, database: transaction }),
    { timeout: 30_000 },
  );
  const makeupScenarios = [
    seedPartialCoverage,
    seedRescheduledCoverage,
    seedNoShowCoverage,
    seedMultipleCoverage,
  ];
  let newCount = 0;
  for (const scenario of makeupScenarios) {
    newCount += await database.$transaction(
      (transaction) => scenario({ ...base, database: transaction }),
      { timeout: 30_000 },
    );
  }
  for (const scenario of SUPPORT_SCENARIOS) {
    newCount += await database.$transaction(
      (transaction) => seedSupportAppointment({ ...base, database: transaction }, scenario),
      { timeout: 30_000 },
    );
  }
  process.stdout.write(
    `Pedagogical appointments loaded: ${legacyCount} legacy, ${newCount} new.\n`,
  );
}

async function seedLegacyAppointments(context: AppointmentSeedContext): Promise<number> {
  const makeups = await context.database.makeup.findMany({
    where: { deletedAt: null },
    include: {
      originEnrollment: { select: { studentId: true } },
      targetClassSession: { include: recordSessionInclude },
    },
    orderBy: { id: "asc" },
  });
  for (const makeup of makeups) {
    const session = makeup.targetClassSession;
    const teacher = responsibleTeacher(session);
    const source = await knownLegacySource(context, makeup);
    const recorder = context.teachers.find((person) => person.id === makeup.attendedById);
    const draft: AppointmentDraft = {
      id: makeup.id,
      legacyMakeupId: makeup.id,
      rescheduledFromId: null,
      studentId: makeup.originEnrollment.studentId,
      enrollmentId: makeup.originEnrollmentId,
      teacherId: teacher?.id ?? makeup.attendedById,
      targetClassSessionId: makeup.targetClassSessionId,
      purpose: "MAKEUP",
      format: session.class.format,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      plannedContent: source ? sourcePlan([source]) : null,
      notes: makeup.reason,
      scheduledAt: makeup.scheduledAt,
      scheduledById: makeup.scheduledById,
    };
    if (!source || makeup.cancelledAt || (makeup.attendedAt && !recorder)) {
      draft.plannedContent = null;
      await importUnknownLegacyAppointment(context, draft, makeup);
      continue;
    }
    await createScheduledAppointment(context, draft, [
      { attendanceId: source.id, minutes: source.minutes },
    ]);
    if (makeup.attendedAt && recorder) {
      await recordSeedAppointment(context, draft.id, {
        actor: recorder,
        at: makeup.attendedAt,
        attended: true,
        minutes: source.minutes,
        content:
          "Participou da aula de reposição com prática orientada de perguntas e respostas, escuta e esclarecimento de dúvidas.",
      });
    }
  }
  return makeups.length;
}

async function seedPartialCoverage(context: AppointmentSeedContext): Promise<number> {
  const enrollment = await scenarioEnrollment(context, 104);
  if (!enrollment) return 0;
  const source = (await scenarioAbsences(context, enrollment)).find((row) => row.minutes === 90);
  if (!source) return 0;
  const attended = await findAppointmentSlot(context, {
    enrollment,
    minutes: 45,
    future: false,
    afterSource: source.confirmedAt,
  });
  const pending = await findAppointmentSlot(context, {
    enrollment,
    minutes: 45,
    future: true,
    afterSource: source.confirmedAt,
  });
  if (!attended || !pending) return 0;
  pending.scheduledAt = new Date(
    Math.max(
      pending.scheduledAt.getTime(),
      minutesAfter(appointmentEndedAt(attended), 11).getTime(),
    ),
  );
  const first = independentDraft(
    context,
    enrollment,
    attended,
    "partial-attended",
    "MAKEUP",
    sourcePlan([source]),
  );
  await createScheduledAppointment(context, first, [{ attendanceId: source.id, minutes: 45 }]);
  await completeIndependent(
    context,
    first.id,
    attended,
    true,
    45,
    "Realizados 45 minutos de escuta e prática de respostas, com orientação individual. A continuidade será retomada em outro atendimento.",
  );
  const second = independentDraft(
    context,
    enrollment,
    pending,
    "partial-remaining",
    "MAKEUP",
    sourcePlan([source]),
  );
  await createScheduledAppointment(context, second, [{ attendanceId: source.id, minutes: 45 }]);
  return 2;
}

async function seedRescheduledCoverage(context: AppointmentSeedContext): Promise<number> {
  const enrollment = await scenarioEnrollment(context, 73);
  if (!enrollment) return 0;
  const source = (await scenarioAbsences(context, enrollment, 14)).find(
    (row) => row.minutes === 90,
  );
  if (!source) return 0;
  const previous = await findAppointmentSlot(context, {
    enrollment,
    minutes: 90,
    future: false,
    afterSource: source.confirmedAt,
  });
  if (!previous) return 0;
  const cancelledAt = cancellationInstant(previous);
  const successor = await findAppointmentSlot(context, {
    enrollment,
    minutes: 90,
    future: false,
    afterSource: source.confirmedAt,
    afterDate: previous.date,
    scheduledAt: minutesAfter(cancelledAt, 1),
  });
  if (!successor) return 0;
  const first = independentDraft(
    context,
    enrollment,
    previous,
    "rescheduled-original",
    "MAKEUP",
    sourcePlan([source]),
  );
  await createScheduledAppointment(context, first, [{ attendanceId: source.id, minutes: 90 }]);
  await cancelForRescheduling(context, first.id, cancelledAt);
  const next = independentDraft(
    context,
    enrollment,
    successor,
    "rescheduled-successor",
    "MAKEUP",
    sourcePlan([source]),
  );
  next.rescheduledFromId = first.id;
  await createScheduledAppointment(context, next, [{ attendanceId: source.id, minutes: 90 }]);
  await completeIndependent(
    context,
    next.id,
    successor,
    true,
    90,
    "Retomadas perguntas e respostas com apoio visual, leitura curta e prática oral. As dúvidas foram revistas ao final do encontro remarcado.",
  );
  return 2;
}

async function seedNoShowCoverage(context: AppointmentSeedContext): Promise<number> {
  const enrollment = await scenarioEnrollment(context, 121);
  if (!enrollment) return 0;
  const source = (await scenarioAbsences(context, enrollment)).find((row) => row.minutes === 90);
  if (!source) return 0;
  const slot = await findAppointmentSlot(context, {
    enrollment,
    minutes: 90,
    future: false,
    afterSource: source.confirmedAt,
  });
  if (!slot) return 0;
  const draft = independentDraft(
    context,
    enrollment,
    slot,
    "makeup-no-show",
    "MAKEUP",
    sourcePlan([source]),
  );
  await createScheduledAppointment(context, draft, [{ attendanceId: source.id, minutes: 90 }]);
  await completeIndependent(context, draft.id, slot, false, 90, "");
  return 1;
}

async function seedMultipleCoverage(context: AppointmentSeedContext): Promise<number> {
  const enrollment = await scenarioEnrollment(context, 102);
  if (!enrollment) return 0;
  const sources = (await scenarioAbsences(context, enrollment))
    .filter((row) => row.minutes === 90)
    .slice(0, 2);
  if (sources.length !== 2) return 0;
  const slot = await findAppointmentSlot(context, {
    enrollment,
    minutes: 120,
    future: false,
    afterSource: new Date(Math.max(...sources.map((row) => row.confirmedAt.getTime()))),
  });
  if (!slot) return 0;
  const draft = independentDraft(
    context,
    enrollment,
    slot,
    "multiple-absences",
    "MAKEUP",
    sourcePlan(sources),
  );
  const coverages: SeedCoverage[] = sources.map((source, index) => ({
    attendanceId: source.id,
    minutes: index === 0 ? 90 : 30,
  }));
  await createScheduledAppointment(context, draft, coverages);
  await completeIndependent(
    context,
    draft.id,
    slot,
    true,
    120,
    "Realizadas duas horas de prática orientada, com escuta, leitura breve e diálogo. O tempo foi distribuído entre as duas faltas de origem, com continuidade ainda necessária para a segunda.",
  );
  return 1;
}

async function seedSupportAppointment(
  context: AppointmentSeedContext,
  scenario: (typeof SUPPORT_SCENARIOS)[number],
): Promise<number> {
  const enrollment = await scenarioEnrollment(context, scenario.studentIndex);
  if (
    !enrollment ||
    (scenario.purpose === "PPT_COMPLEMENT" && enrollment.class.scheduleType !== "PERSONALIZED")
  )
    return 0;
  const slot = await findAppointmentSlot(context, {
    enrollment,
    minutes: scenario.minutes,
    future: scenario.status === "SCHEDULED",
    afterSource: enrollment.entryDate,
  });
  if (!slot) return 0;
  const draft = independentDraft(
    context,
    enrollment,
    slot,
    scenario.key,
    scenario.purpose,
    scenario.plannedContent,
  );
  await createScheduledAppointment(context, draft, []);
  if (scenario.status !== "SCHEDULED") {
    await completeIndependent(
      context,
      draft.id,
      slot,
      scenario.status === "ATTENDED",
      scenario.minutes,
      scenario.performedContent,
    );
    if (scenario.key === "reinforcement-attended") {
      const actor = context.teachers.find((person) => person.id === slot.teacherId)!;
      await recordSeedAppointment(context, draft.id, {
        actor,
        at: minutesAfter(appointmentEndedAt(slot), 30),
        attended: true,
        minutes: scenario.minutes,
        correction: true,
        content: `${scenario.performedContent} Complemento do relato: a devolutiva incluiu nova tentativa sem apoio visual.`,
      });
    }
  }
  return 1;
}

function independentDraft(
  context: AppointmentSeedContext,
  enrollment: AppointmentEnrollment,
  slot: AppointmentSeedSlot,
  key: string,
  purpose: AppointmentDraft["purpose"],
  plannedContent: string | null,
): AppointmentDraft {
  return {
    id: stableUuid(["pedagogical-appointment", key]),
    studentId: enrollment.studentId,
    enrollmentId: enrollment.id,
    teacherId: slot.teacherId,
    targetClassSessionId: null,
    legacyMakeupId: null,
    rescheduledFromId: null,
    purpose,
    format: enrollment.class.format,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    plannedContent,
    notes: null,
    scheduledAt: slot.scheduledAt,
    scheduledById: context.admin.id,
  };
}

async function completeIndependent(
  context: AppointmentSeedContext,
  id: string,
  slot: AppointmentSeedSlot,
  attended: boolean,
  minutes: number,
  content: string,
): Promise<void> {
  const actor = context.teachers.find((person) => person.id === slot.teacherId);
  if (!actor) throw new Error("Appointment fixture teacher must have a known staff identity.");
  await recordSeedAppointment(context, id, {
    actor,
    at: minutesAfter(appointmentEndedAt(slot), 10),
    attended,
    minutes,
    content,
  });
}
