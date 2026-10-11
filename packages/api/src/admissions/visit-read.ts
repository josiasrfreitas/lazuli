import type { Prisma } from "@lazuli/db";
import { responsibleTeacherId } from "@lazuli/domain";
import { dateToTimeString } from "../classes/time.js";
import { meetingKey, meetingsBetween, type TeacherMeeting } from "../teachers/schedule.js";
import { dateOnly } from "./candidates.js";

const visitInclude = {
  teacher: { select: { name: true } },
  class: { select: { portalClassName: true } },
} satisfies Prisma.EntryVisitInclude;
type VisitRow = Prisma.EntryVisitGetPayload<{ include: typeof visitInclude }>;
export type CandidateVisit = Omit<VisitRow, "startTime" | "endTime"> & {
  startTime: string;
  endTime: string;
  teacherName: string | null | undefined;
  needsReschedule: boolean;
};
export async function candidateVisits(
  database: Prisma.TransactionClient,
  {
    id,
    now,
  }: {
    id: string;
    now: Date;
  },
): Promise<CandidateVisit[]> {
  const rows = await database.entryVisit.findMany({
    where: { candidateId: id, deletedAt: null },
    include: visitInclude,
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
  });
  const trials = rows.filter((row) => row.kind === "TRIAL" && row.status === "SCHEDULED");
  const dates = trials.map((row) => dateOnly(row.date)).toSorted();
  const projected =
    dates.length > 0
      ? await meetingsBetween({ database, from: dates[0]!, through: dates.at(-1)!, now })
      : [];
  return rows.map((row) => visitSummary(row, projected));
}
function scheduledTrial(row: VisitRow, meetings: TeacherMeeting[]): TeacherMeeting | undefined {
  if (row.kind !== "TRIAL" || row.status !== "SCHEDULED") return undefined;
  return meetings.find(
    (item) =>
      meetingKey(item) ===
      meetingKey({
        classId: row.classId!,
        slotId: row.scheduleSlotId,
        sessionId: row.classSessionId,
        date: dateOnly(row.date),
      }),
  );
}
function needsReschedule(row: VisitRow, meeting: TeacherMeeting | undefined): boolean {
  if (row.status !== "SCHEDULED" || row.kind !== "TRIAL") return false;
  return !meeting || meeting.cancelled || !responsibleTeacherId(meeting);
}
function visitSummary(row: VisitRow, meetings: TeacherMeeting[]): CandidateVisit {
  const meeting = scheduledTrial(row, meetings);
  return {
    ...row,
    startTime: meeting?.startTime ?? dateToTimeString(row.startTime),
    endTime: meeting?.endTime ?? dateToTimeString(row.endTime),
    teacherName: meeting
      ? (meeting.substituteTeacherName ?? meeting.usualTeacherName)
      : row.teacher?.name,
    needsReschedule: needsReschedule(row, meeting),
  };
}
