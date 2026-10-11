import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import { invalid, type FollowUpContext } from "./data.js";
const sessionInclude = {
  class: { select: { id: true, portalClassName: true, ...responsibilitySelect } },
  substitutions: {
    where: { revokedAt: null, deletedAt: null },
    select: { teacherId: true },
    orderBy: { recordedAt: "desc" },
  },
} satisfies Prisma.ClassSessionInclude;
type Session = Prisma.ClassSessionGetPayload<{ include: typeof sessionInclude }>;
function canReport(context: FollowUpContext, session: Session): boolean {
  const usual = session.responsibilityFrozenAt
    ? session.usualTeacherId
    : usualTeacherOn(session.class, session.date)?.id;
  return (
    context.staffUser.role !== "TEACHER" ||
    (session.substitutions[0]?.teacherId ?? usual) === context.staffUser.id
  );
}
export async function occurrenceSessions(context: FollowUpContext) {
  const today = new Date(saoPauloDateOnly(context.now));
  const rows = await context.database.classSession.findMany({
    where: {
      deletedAt: null,
      status: "SCHEDULED",
      date: { lte: today },
      class: { deletedAt: null },
    },
    include: sessionInclude,
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
    take: 600,
  });
  return rows
    .filter((row) => canReport(context, row))
    .map((row) => ({
      id: row.id,
      date: row.date,
      startTime: row.startTime,
      className: row.class.portalClassName,
    }));
}
export async function loadReportSession(context: FollowUpContext, id: string): Promise<Session> {
  const row = await context.database.classSession.findFirst({
    where: { id, deletedAt: null, status: "SCHEDULED", class: { deletedAt: null } },
    include: sessionInclude,
  });
  if (!row || !canReport(context, row)) invalid("Aula indisponível para este professor.");
  if (row.date > new Date(saoPauloDateOnly(context.now)))
    invalid("Escolha uma aula que já aconteceu.");
  return row;
}
export async function occurrenceRoster(context: FollowUpContext, sessionId: string) {
  const session = await loadReportSession(context, sessionId);
  return context.database.student.findMany({
    where: {
      deletedAt: null,
      enrollments: {
        some: {
          deletedAt: null,
          classId: session.classId,
          entryDate: { lte: session.date },
          OR: [{ exitDate: null }, { exitDate: { gt: session.date } }],
        },
      },
    },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}
export async function interventionTeachers(context: FollowUpContext) {
  return context.database.user.findMany({
    where: {
      deletedAt: null,
      teacherProfile: {
        deletedAt: null,
        OR: [
          { departureDate: null },
          { departureDate: { gt: new Date(saoPauloDateOnly(context.now)) } },
        ],
      },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
