import type { Prisma } from "../../packages/db/src/index.js";
import { seedStudentIndex } from "./student-fixtures.js";
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
  type SeedAbsence,
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

const MAKEUP_MINUTES = { full: 90, half: 45, multiple: 120, remainder: 30 };
const FOLLOWUP_SCHEDULING_DELAY_MINUTES = 11;
const OUTCOME_DELAY_MINUTES = 10;
const CORRECTION_DELAY_MINUTES = 30;
type LegacyMakeup = Prisma.MakeupGetPayload<{
  include: {
    originEnrollment: { select: { studentId: true } };
    targetClassSession: { include: typeof recordSessionInclude };
  };
}>;
type IndependentDraftInput = {
  enrollment: AppointmentEnrollment;
  slot: AppointmentSeedSlot;
  key: string;
  purpose: AppointmentDraft["purpose"];
  plannedContent: string | null;
};
type IndependentOutcome = {
  id: string;
  slot: AppointmentSeedSlot;
  attended: boolean;
  minutes: number;
  content: string;
};

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
    const draft = legacyDraft({ makeup, teacher, source });
    if (!source || makeup.cancelledAt || (makeup.attendedAt && !recorder)) {
      draft.plannedContent = null;
      await importUnknownLegacyAppointment(context, { draft, legacy: makeup });
      continue;
    }
    await createScheduledAppointment(context, {
      draft,
      coverages: [{ attendanceId: source.id, minutes: source.minutes }],
    });
    if (makeup.attendedAt && recorder) {
      await recordSeedAppointment(context, {
        id: draft.id,
        outcome: {
          actor: recorder,
          at: makeup.attendedAt,
          attended: true,
          minutes: source.minutes,
          content:
            "Participou da aula de reposição com prática orientada de perguntas e respostas, escuta e esclarecimento de dúvidas.",
        },
      });
    }
  }
  return makeups.length;
}

function legacyDraft(input: {
  makeup: LegacyMakeup;
  teacher: ReturnType<typeof responsibleTeacher>;
  source: SeedAbsence | null;
}): AppointmentDraft {
  const { makeup, teacher, source } = input;
  const session = makeup.targetClassSession;
  return {
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
}

async function seedPartialCoverage(context: AppointmentSeedContext): Promise<number> {
  const enrollment = await scenarioEnrollment(context, seedStudentIndex("school-student-105"));
  if (!enrollment) return 0;
  const absences = await scenarioAbsences(context, { enrollment });
  const source = absences.find((row) => row.minutes === MAKEUP_MINUTES.full);
  if (!source) return 0;
  const slots = await partialCoverageSlots(context, { enrollment, source });
  if (!slots) return 0;
  const { attended, pending } = slots;
  const first = independentDraft(context, {
    enrollment,
    slot: attended,
    key: "partial-attended",
    purpose: "MAKEUP",
    plannedContent: sourcePlan([source]),
  });
  await createScheduledAppointment(context, {
    draft: first,
    coverages: [{ attendanceId: source.id, minutes: MAKEUP_MINUTES.half }],
  });
  await completeIndependent(context, {
    id: first.id,
    slot: attended,
    attended: true,
    minutes: MAKEUP_MINUTES.half,
    content:
      "Realizados 45 minutos de escuta e prática de respostas, com orientação individual. A continuidade será retomada em outro atendimento.",
  });
  const second = independentDraft(context, {
    enrollment,
    slot: pending,
    key: "partial-remaining",
    purpose: "MAKEUP",
    plannedContent: sourcePlan([source]),
  });
  await createScheduledAppointment(context, {
    draft: second,
    coverages: [{ attendanceId: source.id, minutes: MAKEUP_MINUTES.half }],
  });
  return 2;
}

async function partialCoverageSlots(
  context: AppointmentSeedContext,
  origin: { enrollment: AppointmentEnrollment; source: SeedAbsence },
): Promise<{ attended: AppointmentSeedSlot; pending: AppointmentSeedSlot } | null> {
  const { enrollment, source } = origin;
  const attended = await findAppointmentSlot(context, {
    enrollment,
    minutes: MAKEUP_MINUTES.half,
    future: false,
    afterSource: source.confirmedAt,
  });
  const pending = await findAppointmentSlot(context, {
    enrollment,
    minutes: MAKEUP_MINUTES.half,
    future: true,
    afterSource: source.confirmedAt,
  });
  if (!attended || !pending) return null;
  pending.scheduledAt = new Date(
    Math.max(
      pending.scheduledAt.getTime(),
      minutesAfter(appointmentEndedAt(attended), FOLLOWUP_SCHEDULING_DELAY_MINUTES).getTime(),
    ),
  );
  return { attended, pending };
}

async function seedRescheduledCoverage(context: AppointmentSeedContext): Promise<number> {
  const enrollment = await scenarioEnrollment(context, seedStudentIndex("school-student-74"));
  if (!enrollment) return 0;
  const absences = await scenarioAbsences(context, { enrollment, daysBeforeToday: 14 });
  const source = absences.find((row) => row.minutes === MAKEUP_MINUTES.full);
  if (!source) return 0;
  const slots = await rescheduledCoverageSlots(context, { enrollment, source });
  if (!slots) return 0;
  const { previous, successor, cancelledAt } = slots;
  const first = independentDraft(context, {
    enrollment,
    slot: previous,
    key: "rescheduled-original",
    purpose: "MAKEUP",
    plannedContent: sourcePlan([source]),
  });
  await createScheduledAppointment(context, {
    draft: first,
    coverages: [{ attendanceId: source.id, minutes: MAKEUP_MINUTES.full }],
  });
  await cancelForRescheduling(context, { id: first.id, at: cancelledAt });
  const next = independentDraft(context, {
    enrollment,
    slot: successor,
    key: "rescheduled-successor",
    purpose: "MAKEUP",
    plannedContent: sourcePlan([source]),
  });
  next.rescheduledFromId = first.id;
  await createScheduledAppointment(context, {
    draft: next,
    coverages: [{ attendanceId: source.id, minutes: MAKEUP_MINUTES.full }],
  });
  await completeIndependent(context, {
    id: next.id,
    slot: successor,
    attended: true,
    minutes: MAKEUP_MINUTES.full,
    content:
      "Retomadas perguntas e respostas com apoio visual, leitura curta e prática oral. As dúvidas foram revistas ao final do encontro remarcado.",
  });
  return 2;
}

async function rescheduledCoverageSlots(
  context: AppointmentSeedContext,
  origin: { enrollment: AppointmentEnrollment; source: SeedAbsence },
): Promise<{
  previous: AppointmentSeedSlot;
  successor: AppointmentSeedSlot;
  cancelledAt: Date;
} | null> {
  const { enrollment, source } = origin;
  const previous = await findAppointmentSlot(context, {
    enrollment,
    minutes: MAKEUP_MINUTES.full,
    future: false,
    afterSource: source.confirmedAt,
  });
  if (!previous) return null;
  const cancelledAt = cancellationInstant(previous);
  const successor = await findAppointmentSlot(context, {
    enrollment,
    minutes: MAKEUP_MINUTES.full,
    future: false,
    afterSource: source.confirmedAt,
    afterDate: previous.date,
    scheduledAt: minutesAfter(cancelledAt, 1),
  });
  if (!successor) return null;
  return { previous, successor, cancelledAt };
}

async function seedNoShowCoverage(context: AppointmentSeedContext): Promise<number> {
  const enrollment = await scenarioEnrollment(context, seedStudentIndex("school-student-122"));
  if (!enrollment) return 0;
  const absences = await scenarioAbsences(context, { enrollment });
  const source = absences.find((row) => row.minutes === MAKEUP_MINUTES.full);
  if (!source) return 0;
  const slot = await findAppointmentSlot(context, {
    enrollment,
    minutes: MAKEUP_MINUTES.full,
    future: false,
    afterSource: source.confirmedAt,
  });
  if (!slot) return 0;
  const draft = independentDraft(context, {
    enrollment,
    slot,
    key: "makeup-no-show",
    purpose: "MAKEUP",
    plannedContent: sourcePlan([source]),
  });
  await createScheduledAppointment(context, {
    draft,
    coverages: [{ attendanceId: source.id, minutes: MAKEUP_MINUTES.full }],
  });
  await completeIndependent(context, {
    id: draft.id,
    slot,
    attended: false,
    minutes: MAKEUP_MINUTES.full,
    content: "",
  });
  return 1;
}

async function seedMultipleCoverage(context: AppointmentSeedContext): Promise<number> {
  const enrollment = await scenarioEnrollment(context, seedStudentIndex("school-student-103"));
  if (!enrollment) return 0;
  const absences = await scenarioAbsences(context, { enrollment });
  const sources = absences.filter((row) => row.minutes === MAKEUP_MINUTES.full).slice(0, 2);
  if (sources.length !== 2) return 0;
  const slot = await findAppointmentSlot(context, {
    enrollment,
    minutes: MAKEUP_MINUTES.multiple,
    future: false,
    afterSource: new Date(Math.max(...sources.map((row) => row.confirmedAt.getTime()))),
  });
  if (!slot) return 0;
  const draft = independentDraft(context, {
    enrollment,
    slot,
    key: "multiple-absences",
    purpose: "MAKEUP",
    plannedContent: sourcePlan(sources),
  });
  const coverages: SeedCoverage[] = sources.map((source, index) => ({
    attendanceId: source.id,
    minutes: index === 0 ? MAKEUP_MINUTES.full : MAKEUP_MINUTES.remainder,
  }));
  await createScheduledAppointment(context, { draft, coverages });
  await completeIndependent(context, {
    id: draft.id,
    slot,
    attended: true,
    minutes: MAKEUP_MINUTES.multiple,
    content:
      "Realizadas duas horas de prática orientada, com escuta, leitura breve e diálogo. O tempo foi distribuído entre as duas faltas de origem, com continuidade ainda necessária para a segunda.",
  });
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
  const draft = independentDraft(context, {
    enrollment,
    slot,
    key: scenario.key,
    purpose: scenario.purpose,
    plannedContent: scenario.plannedContent,
  });
  await createScheduledAppointment(context, { draft, coverages: [] });
  if (scenario.status !== "SCHEDULED") {
    await completeIndependent(context, {
      id: draft.id,
      slot,
      attended: scenario.status === "ATTENDED",
      minutes: scenario.minutes,
      content: scenario.performedContent,
    });
    if (scenario.key === "reinforcement-attended") {
      const actor = context.teachers.find((person) => person.id === slot.teacherId)!;
      await recordSeedAppointment(context, {
        id: draft.id,
        outcome: {
          actor,
          at: minutesAfter(appointmentEndedAt(slot), CORRECTION_DELAY_MINUTES),
          attended: true,
          minutes: scenario.minutes,
          correction: true,
          content: `${scenario.performedContent} Complemento do relato: a devolutiva incluiu nova tentativa sem apoio visual.`,
        },
      });
    }
  }
  return 1;
}

function independentDraft(
  context: AppointmentSeedContext,
  input: IndependentDraftInput,
): AppointmentDraft {
  const { enrollment, slot, key, purpose, plannedContent } = input;
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
  input: IndependentOutcome,
): Promise<void> {
  const { id, slot, attended, minutes, content } = input;
  const actor = context.teachers.find((person) => person.id === slot.teacherId);
  if (!actor) throw new Error("Appointment fixture teacher must have a known staff identity.");
  await recordSeedAppointment(context, {
    id,
    outcome: {
      actor,
      at: minutesAfter(appointmentEndedAt(slot), OUTCOME_DELAY_MINUTES),
      attended,
      minutes,
      content,
    },
  });
}
