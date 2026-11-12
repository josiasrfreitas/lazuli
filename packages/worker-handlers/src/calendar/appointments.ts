import type { CalendarReconciliationRequest, Prisma } from "@lazuli/db";
import {
  appointmentEvidenceInclude,
  createAppointmentEvidence,
} from "@lazuli/db/appointment-evidence";
import { academicActivityCanBeCancelled } from "@lazuli/domain";

export async function cancelCalendarAppointment(
  database: Prisma.TransactionClient,
  id: string,
  request: CalendarReconciliationRequest,
  now: Date,
) {
  const row = await database.pedagogicalAppointment.findUniqueOrThrow({
    where: { id },
    include: appointmentEvidenceInclude,
  });
  if (
    !academicActivityCanBeCancelled({
      ...row,
      recorded: Boolean(row.recordedAt || row.performedContent || row.performedMinutes),
      now,
    })
  )
    return 0;
  if (row.legacyMakeupId && row.version === 0)
    await database.appointmentRevision.upsert({
      where: { appointmentId_version: { appointmentId: id, version: 0 } },
      update: {},
      create: {
        appointmentId: id,
        version: 0,
        actorId: row.recordedById ?? row.scheduledById,
        recordedAt: row.recordedAt ?? row.scheduledAt,
        kind: "IMPORTED",
        reason:
          "Registro anterior aos atendimentos. Informações não registradas permanecem desconhecidas.",
        snapshot: createAppointmentEvidence(row),
      },
    });
  const saved = await database.pedagogicalAppointment.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      cancelledById: request.requestedById,
      cancellationReason: request.reason,
      version: { increment: 1 },
    },
    include: appointmentEvidenceInclude,
  });
  await database.appointmentRevision.create({
    data: {
      appointmentId: id,
      version: saved.version,
      actorId: request.requestedById,
      recordedAt: now,
      kind: "CANCELLED",
      reason: request.reason,
      snapshot: createAppointmentEvidence(saved),
    },
  });
  if (saved.legacyMakeupId)
    await database.makeup.update({
      where: { id: saved.legacyMakeupId },
      data: {
        attendedAt: null,
        attendedById: null,
        cancelledAt: now,
        cancelledById: request.requestedById,
        cancellationReason: request.reason,
      },
    });
  return 1;
}
