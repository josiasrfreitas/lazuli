import type { Prisma } from "@lazuli/db";
import { intervalsOverlap, weekdayOf } from "@lazuli/domain";
import { badRequest } from "../trpc/errors.js";
import { dateToTimeString } from "../classes/time.js";

const ISO_DATE_LENGTH = 10;
export type Introduction = {
  id: string;
  candidateId: string;
  candidateName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: Prisma.EntryVisitGetPayload<Record<string, never>>["status"];
  format: Prisma.EntryVisitGetPayload<Record<string, never>>["format"];
};
export async function introductoryMeetings({
  database,
  teacherId,
  from,
  through,
}: {
  database: Prisma.TransactionClient;
  teacherId: string;
  from: string;
  through: string;
}): Promise<Introduction[]> {
  const rows = await database.entryVisit.findMany({
    where: {
      kind: "INTRODUCTION",
      teacherId,
      deletedAt: null,
      date: { gte: new Date(from), lte: new Date(through) },
    },
    include: { candidate: { select: { id: true, fullName: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    candidateId: row.candidate.id,
    candidateName: row.candidate.fullName,
    date: row.date.toISOString().slice(0, ISO_DATE_LENGTH),
    startTime: dateToTimeString(row.startTime),
    endTime: dateToTimeString(row.endTime),
    status: row.status,
    format: row.format,
  }));
}
export async function assertNoIntroductionConflict(input: {
  database: Prisma.TransactionClient;
  teacherId: string;
  from: string;
  through: string;
  slots: readonly { weekday: string; startTime: string; endTime: string }[];
  candidateMeetings?: readonly { date: string; startTime: string; endTime: string }[];
}): Promise<void> {
  const visits = await introductoryMeetings(input);
  for (const visit of visits) {
    if (visit.status === "CANCELLED") continue;
    const overlaps = input.candidateMeetings
      ? input.candidateMeetings.some(
          (row) => row.date === visit.date && intervalsOverlap(row, visit),
        )
      : input.slots.some(
          (row) => row.weekday === weekdayOf(visit.date) && intervalsOverlap(row, visit),
        );
    if (overlaps)
      throw badRequest(
        `Conflito com aula introdutória em ${visit.date.split("-").toReversed().join("/")}, ${visit.startTime}–${visit.endTime}.`,
      );
  }
}
