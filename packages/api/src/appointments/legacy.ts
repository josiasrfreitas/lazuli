import type { LegacyAppointment } from "./view-types.js";
import type { Prisma } from "@lazuli/db";
import { recordSessionInclude, responsibleTeacher } from "../class-records/data.js";
import { notFound } from "../trpc/errors.js";

/** Bridges records created by older imports as well as the one-time migration; missing facts stay null. */
export async function ensureLegacyAppointment(
  database: Prisma.TransactionClient,
  makeupId: string,
): Promise<LegacyAppointment> {
  const linked = await database.pedagogicalAppointment.findUnique({
    where: { legacyMakeupId: makeupId },
  });
  if (linked) return linked;
  const legacy = await database.makeup.findUnique({
    where: { id: makeupId },
    include: { originEnrollment: true, targetClassSession: { include: recordSessionInclude } },
  });
  if (!legacy) throw notFound("Reposição não encontrada.");
  const target = legacy.targetClassSession;
  return database.pedagogicalAppointment.create({
    data: {
      id: legacy.id,
      legacyMakeupId: legacy.id,
      studentId: legacy.originEnrollment.studentId,
      enrollmentId: legacy.originEnrollmentId,
      targetClassSessionId: target.id,
      teacherId: responsibleTeacher(target)?.id ?? null,
      date: target.date,
      startTime: target.startTime,
      endTime: target.endTime,
      format: target.class.format,
      purpose: "MAKEUP",
      status: legacyStatus(legacy),
      version: 0,
      scheduledAt: legacy.scheduledAt,
      scheduledById: legacy.scheduledById,
      recordedAt: legacy.attendedAt,
      recordedById: legacy.attendedById,
      cancelledAt: legacy.cancelledAt,
      cancelledById: legacy.cancelledById,
      cancellationReason: legacy.cancellationReason,
      notes: legacy.reason,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
    },
  });
}

function legacyStatus(row: {
  cancelledAt: Date | null;
  attendedAt: Date | null;
}): LegacyAppointment["status"] {
  if (row.cancelledAt) return "CANCELLED";
  return row.attendedAt ? "ATTENDED" : "SCHEDULED";
}
