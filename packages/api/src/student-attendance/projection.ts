import type { Prisma } from "@lazuli/db";
import { badRequest } from "../trpc/errors.js";
import type { AttendanceReceipt } from "./types.js";
import { tokenHash, windowToken } from "./data.js";

export async function readAttendanceProjection(
  context: { database: Prisma.TransactionClient; now: Date },
  token: string,
): Promise<{ token: string | null; expiresAt: Date | null }> {
  const { database, now } = context;
  const projection = await database.attendanceProjection.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: {
      window: true,
      classSession: {
        select: {
          status: true,
          deletedAt: true,
          attendanceConfirmedAt: true,
          class: { select: { deletedAt: true } },
        },
      },
    },
  });
  if (!projection) throw badRequest("Projeção encerrada. Peça um novo acesso ao professor.");
  const session = projection.classSession;
  if (
    projection.expiresAt <= now ||
    session.deletedAt ||
    session.class.deletedAt ||
    session.status === "CANCELLED" ||
    session.attendanceConfirmedAt
  )
    throw badRequest("Projeção encerrada. O professor pode registrar a presença manualmente.");
  return projectionLink({ now, token }, projection.window);
}

function projectionLink(
  context: { now: Date; token: string },
  active: Prisma.AttendanceWindowGetPayload<object> | null,
): { token: string | null; expiresAt: Date | null } {
  const { now, token } = context;
  if (
    !active ||
    active.deletedAt ||
    active.closedAt ||
    active.openedAt > now ||
    active.expiresAt <= now
  )
    return { token: null, expiresAt: active?.expiresAt ?? null };
  const candidate = windowToken(token, active.id);
  return {
    token: tokenHash(candidate) === active.tokenHash ? candidate : null,
    expiresAt: active.expiresAt,
  };
}

export async function attendanceReceipt(
  database: Prisma.TransactionClient,
  input: { token: string; browserId: string },
): Promise<AttendanceReceipt | null> {
  const { token, browserId } = input;
  const window = await database.attendanceWindow.findUnique({
    where: { tokenHash: tokenHash(token) },
    select: { classSessionId: true },
  });
  if (!window) return null;
  const row = await database.attendanceDeclaration.findUnique({
    where: {
      classSessionId_browserHash: {
        classSessionId: window.classSessionId,
        browserHash: tokenHash(`${window.classSessionId}:${browserId}`),
      },
    },
    select: {
      submittedAt: true,
      enrollment: { select: { student: { select: { fullName: true } } } },
    },
  });
  return row ? { submittedAt: row.submittedAt, name: row.enrollment.student.fullName } : null;
}
