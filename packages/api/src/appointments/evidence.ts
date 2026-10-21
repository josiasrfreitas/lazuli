import { TRPCError } from "@trpc/server";
import { recordActivity } from "../activity/record.js";
import type { ActivityAction } from "../activity/catalog.js";
import { appointmentInclude, type AppointmentContext, type AppointmentRow } from "./data.js";
import { appointmentSnapshot } from "./snapshot.js";

export function assertAppointmentVersion(row: AppointmentRow, expectedVersion: number): void {
  if (row.version !== expectedVersion)
    throw new TRPCError({
      code: "CONFLICT",
      message: "O atendimento mudou. Atualize antes de salvar novamente.",
    });
}
export async function preserveImportedAppointment(
  context: AppointmentContext,
  row: AppointmentRow,
): Promise<void> {
  if (!row.legacyMakeupId || row.version !== 0) return;
  await context.database.appointmentRevision.upsert({
    where: { appointmentId_version: { appointmentId: row.id, version: 0 } },
    update: {},
    create: {
      appointmentId: row.id,
      version: 0,
      actorId: row.recordedById ?? row.scheduledById,
      recordedAt: row.recordedAt ?? row.scheduledAt,
      kind: "IMPORTED",
      reason:
        "Registro anterior aos atendimentos. Informações não registradas permanecem desconhecidas.",
      snapshot: appointmentSnapshot(row),
    },
  });
}
export async function recordAppointmentRevision(
  context: AppointmentContext,
  id: string,
  kind: "SCHEDULED" | "RECORDED" | "CORRECTED" | "CANCELLED" | "RESCHEDULED",
  reason: string | null,
) {
  const row = await context.database.pedagogicalAppointment.findUniqueOrThrow({
    where: { id },
    include: appointmentInclude,
  });
  await context.database.appointmentRevision.create({
    data: {
      appointmentId: id,
      version: row.version,
      actorId: context.staffUser.id,
      recordedAt: context.now,
      kind,
      reason,
      snapshot: appointmentSnapshot(row),
    },
  });
  return row;
}
export async function appointmentActivity(
  context: AppointmentContext,
  row: AppointmentRow,
  action: ActivityAction,
  description: string,
): Promise<void> {
  await recordActivity(context.database, context, action, {
    subject: { type: "student", id: row.studentId, name: row.student.fullName },
    description,
    deduplicationKey: `${action}:${row.id}:${row.version}`,
  });
}
export async function synchronizeLegacyMakeup(
  context: AppointmentContext,
  row: AppointmentRow,
): Promise<void> {
  if (!row.legacyMakeupId) return;
  await context.database.makeup.update({
    where: { id: row.legacyMakeupId },
    data: {
      attendedAt: row.status === "ATTENDED" ? row.recordedAt : null,
      attendedById: row.status === "ATTENDED" ? row.recordedById : null,
      cancelledAt: row.cancelledAt,
      cancelledById: row.cancelledById,
      cancellationReason: row.cancellationReason,
    },
  });
}
