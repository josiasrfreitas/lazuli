import type { Prisma } from "@lazuli/db";
import { badRequest } from "../trpc/errors.js";
import { tokenHash } from "./data.js";

export async function readAttendanceProjection(database: Prisma.TransactionClient, token: string, now: Date) {
  const projection = await database.attendanceProjection.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { classSession: { select: { status: true, deletedAt: true, attendanceConfirmedAt: true } } },
  });
  if (!projection || projection.expiresAt <= now || projection.classSession.deletedAt || projection.classSession.status === "CANCELLED" || projection.classSession.attendanceConfirmedAt)
    throw badRequest("Projeção encerrada. O professor pode registrar a presença manualmente.");
  const active = projection.attendanceToken ? await database.attendanceWindow.findUnique({ where: { tokenHash: tokenHash(projection.attendanceToken) }, select: { closedAt: true, expiresAt: true } }) : null;
  return {
    token: active && !active.closedAt && active.expiresAt > now ? projection.attendanceToken : null,
    expiresAt: active?.expiresAt ?? null,
  };
}

export async function attendanceReceipt(database: Prisma.TransactionClient, token: string, browserId: string) {
  const window = await database.attendanceWindow.findUnique({ where: { tokenHash: tokenHash(token) }, select: { classSessionId: true } });
  if (!window) return null;
  const row = await database.attendanceDeclaration.findUnique({
    where: { classSessionId_browserHash: { classSessionId: window.classSessionId, browserHash: tokenHash(`${window.classSessionId}:${browserId}`) } },
    select: { submittedAt: true, enrollment: { select: { student: { select: { fullName: true } } } } },
  });
  return row ? { submittedAt: row.submittedAt, name: row.enrollment.student.fullName } : null;
}
