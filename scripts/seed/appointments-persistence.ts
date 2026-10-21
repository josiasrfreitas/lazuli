import type { StaffUser } from "../../packages/api/src/trpc/context.js";
import { recordActivity } from "../../packages/api/src/activity/record.js";
import { appointmentInclude } from "../../packages/api/src/appointments/data.js";
import { validateCoverages } from "../../packages/api/src/appointments/coverage.js";
import { appointmentSnapshot } from "../../packages/api/src/appointments/snapshot.js";
import { appointmentSnapshotSchema } from "../../packages/validators/src/appointments.js";
import { isoOf, stableUuid } from "../../packages/db/src/seed-dev-support.js";
import { saoPauloDateOnly, sessionEndInstant } from "../../packages/domain/src/session-time.js";
import {
  type AppointmentSeedContext,
  type SeedCoverage,
  type SeedPurpose,
} from "./appointments-data.js";

const MILLISECONDS_PER_MINUTE = 60_000;

export type AppointmentDraft = {
  id: string;
  studentId: string;
  enrollmentId: string | null;
  teacherId: string | null;
  targetClassSessionId: string | null;
  legacyMakeupId: string | null;
  rescheduledFromId: string | null;
  purpose: SeedPurpose;
  format: "IN_PERSON" | "ONLINE";
  date: Date;
  startTime: Date;
  endTime: Date;
  plannedContent: string | null;
  notes: string | null;
  scheduledAt: Date;
  scheduledById: string | null;
};
type RevisionKind =
  | "SCHEDULED"
  | "RECORDED"
  | "CORRECTED"
  | "CANCELLED"
  | "RESCHEDULED"
  | "IMPORTED";

export async function createScheduledAppointment(
  context: AppointmentSeedContext,
  draft: AppointmentDraft,
  coverages: SeedCoverage[],
): Promise<void> {
  if (
    draft.scheduledAt >= sessionEndInstant({ date: draft.date, endTime: draft.startTime }) ||
    saoPauloDateOnly(draft.scheduledAt) >= context.todayIso
  )
    throw new Error(
      "Appointment fixtures require a past scheduling fact before the encounter starts.",
    );
  await assertSeedCoverages(context, draft, coverages);
  await context.database.pedagogicalAppointment.create({
    data: {
      ...draft,
      status: "SCHEDULED",
      version: 1,
      createdAt: draft.scheduledAt,
      updatedAt: draft.scheduledAt,
    },
  });
  await storeCoverages(context, draft.id, coverages, draft.scheduledAt);
  const actor = [context.admin, ...context.teachers].find(
    (person) => person.id === draft.scheduledById,
  );
  await appendRevision(context, draft.id, "SCHEDULED", actor ?? null, draft.scheduledAt, null);
}

export async function recordSeedAppointment(
  context: AppointmentSeedContext,
  id: string,
  input: {
    actor: StaffUser;
    at: Date;
    attended: boolean;
    minutes: number;
    content: string;
    correction?: boolean;
  },
): Promise<void> {
  const row = await context.database.pedagogicalAppointment.findUniqueOrThrow({ where: { id } });
  if (
    input.at < sessionEndInstant(row) ||
    input.at < row.scheduledAt ||
    saoPauloDateOnly(input.at) >= context.todayIso ||
    (input.actor.role === "TEACHER" && saoPauloDateOnly(input.at) !== isoOf(row.date)) ||
    (input.attended &&
      (!input.content.trim() || !Number.isInteger(input.minutes) || input.minutes < 1))
  )
    throw new Error("Appointment outcomes require a past completed encounter and actual delivery.");
  const coverages = input.attended
    ? await context.database.makeupCoverage.findMany({
        where: { appointmentId: id, deletedAt: null },
        select: { attendanceId: true, minutes: true },
      })
    : [];
  await validateCoverages(
    { database: context.database, staffUser: input.actor, now: input.at },
    {
      studentId: row.studentId,
      appointmentId: id,
      purpose: row.purpose,
      date: row.date,
      startTime: row.startTime,
      maximumMinutes: input.attended ? input.minutes : 0,
      coverages,
    },
  );
  if (!input.attended)
    await context.database.makeupCoverage.updateMany({
      where: { appointmentId: id, deletedAt: null },
      data: { deletedAt: input.at, updatedAt: input.at },
    });
  await context.database.pedagogicalAppointment.update({
    where: { id },
    data: {
      status: input.attended ? "ATTENDED" : "NO_SHOW",
      performedMinutes: input.attended ? input.minutes : null,
      performedContent: input.attended ? input.content : null,
      recordedAt: input.at,
      recordedById: input.actor.id,
      version: row.version + 1,
      updatedAt: input.at,
    },
  });
  await appendRevision(
    context,
    id,
    input.correction ? "CORRECTED" : "RECORDED",
    input.actor,
    input.at,
    input.correction
      ? "Complementar a devolutiva realizada no atendimento, preservando o registro anterior."
      : null,
  );
}

export async function cancelForRescheduling(
  context: AppointmentSeedContext,
  id: string,
  at: Date,
): Promise<void> {
  const row = await context.database.pedagogicalAppointment.findUniqueOrThrow({ where: { id } });
  const reason =
    "Família solicitou outro horário; atendimento remarcado mantendo a falta de origem.";
  await context.database.pedagogicalAppointment.update({
    where: { id },
    data: {
      status: "CANCELLED",
      version: row.version + 1,
      cancelledAt: at,
      cancelledById: context.admin.id,
      cancellationReason: reason,
      updatedAt: at,
    },
  });
  await appendRevision(context, id, "RESCHEDULED", context.admin, at, reason);
}

/** Unknown legacy facts remain an explicit version-zero import, without compensation or made-up delivery. */
export async function importUnknownLegacyAppointment(
  context: AppointmentSeedContext,
  draft: AppointmentDraft,
  legacy: {
    attendedAt: Date | null;
    attendedById: string | null;
    cancelledAt: Date | null;
    cancelledById: string | null;
    cancellationReason: string | null;
  },
): Promise<void> {
  const latest = legacy.cancelledAt ?? legacy.attendedAt ?? draft.scheduledAt;
  await context.database.pedagogicalAppointment.create({
    data: {
      ...draft,
      version: 0,
      status: legacy.cancelledAt ? "CANCELLED" : legacy.attendedAt ? "ATTENDED" : "SCHEDULED",
      performedMinutes: null,
      performedContent: null,
      recordedAt: legacy.attendedAt,
      recordedById: legacy.attendedById,
      cancelledAt: legacy.cancelledAt,
      cancelledById: legacy.cancelledById,
      cancellationReason: legacy.cancellationReason,
      createdAt: draft.scheduledAt,
      updatedAt: latest,
    },
  });
  const actor = [context.admin, ...context.teachers].find(
    (person) => person.id === (legacy.cancelledById ?? legacy.attendedById ?? draft.scheduledById),
  );
  await appendRevision(
    context,
    draft.id,
    "IMPORTED",
    actor ?? null,
    latest,
    "Origem verificada não disponível; preservar somente as evidências legadas.",
  );
}

async function assertSeedCoverages(
  context: AppointmentSeedContext,
  draft: AppointmentDraft,
  coverages: SeedCoverage[],
): Promise<void> {
  const duration = (draft.endTime.getTime() - draft.startTime.getTime()) / MILLISECONDS_PER_MINUTE;
  if (
    (draft.purpose === "MAKEUP") !== coverages.length > 0 ||
    new Set(coverages.map((row) => row.attendanceId)).size !== coverages.length ||
    coverages.some((row) => !Number.isInteger(row.minutes) || row.minutes < 1) ||
    coverages.reduce((sum, row) => sum + row.minutes, 0) > duration
  )
    throw new Error("Appointment fixtures require distinct origins within their planned minutes.");
  await validateCoverages(
    { database: context.database, staffUser: context.admin, now: draft.scheduledAt },
    {
      studentId: draft.studentId,
      appointmentId: draft.id,
      purpose: draft.purpose,
      date: draft.date,
      startTime: draft.startTime,
      maximumMinutes: duration,
      coverages,
    },
  );
}

async function storeCoverages(
  context: AppointmentSeedContext,
  appointmentId: string,
  coverages: SeedCoverage[],
  at: Date,
) {
  if (!coverages.length) return;
  await context.database.makeupCoverage.createMany({
    data: coverages.map((coverage) => ({
      ...coverage,
      appointmentId,
      id: stableUuid(["makeup-coverage", appointmentId, coverage.attendanceId]),
      createdAt: at,
      updatedAt: at,
    })),
  });
}

async function appendRevision(
  context: AppointmentSeedContext,
  id: string,
  kind: RevisionKind,
  actor: StaffUser | null,
  at: Date,
  reason: string | null,
): Promise<void> {
  const row = await context.database.pedagogicalAppointment.findUniqueOrThrow({
    where: { id },
    include: appointmentInclude,
  });
  const snapshot = appointmentSnapshotSchema.parse(appointmentSnapshot(row));
  await context.database.appointmentRevision.create({
    data: {
      id: stableUuid(["appointment-revision", id, String(row.version)]),
      appointmentId: id,
      version: row.version,
      actorId: actor?.id ?? null,
      recordedAt: at,
      kind,
      reason,
      snapshot,
      createdAt: at,
      updatedAt: at,
    },
  });
  if (!actor || kind === "IMPORTED") return;
  const action = {
    SCHEDULED: "appointments.schedule",
    RECORDED: "appointments.record",
    CORRECTED: "appointments.correct",
    CANCELLED: "appointments.cancel",
    RESCHEDULED: "appointments.reschedule",
  } as const;
  await recordActivity(context.database, { staffUser: actor, now: at }, action[kind], {
    subject: { type: "student", id: row.studentId, name: row.student.fullName },
    description:
      reason ??
      (kind === "SCHEDULED"
        ? "Horário reservado para atendimento pedagógico."
        : row.status === "NO_SHOW"
          ? "Não comparecimento registrado; sem compensação de falta."
          : "Comparecimento e conteúdo realizado registrados no atendimento."),
    deduplicationKey: `seed-appointment/${id}/${row.version}`,
  });
}
