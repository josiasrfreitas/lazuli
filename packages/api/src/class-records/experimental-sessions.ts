import { sessionEndInstant } from "@lazuli/domain";
import type { Prisma } from "@lazuli/db";
import type { classRecordListSchema, z } from "@lazuli/validators";
import { dateOnly, timeOnly, type RecordContext } from "./data.js";

const individualSessionSelect = {
  id: true,
  kind: true,
  date: true,
  startTime: true,
  endTime: true,
  status: true,
  format: true,
  candidate: {
    select: {
      id: true,
      fullName: true,
      scheduleType: true,
      stage: { select: { name: true } },
    },
  },
  teacher: { select: { id: true, name: true } },
} satisfies Prisma.EntryVisitSelect;
type IndividualVisit = Prisma.EntryVisitGetPayload<{ select: typeof individualSessionSelect }>;
type IndividualSession = Omit<IndividualVisit, "date" | "startTime" | "endTime"> & {
  date: string;
  startTime: string;
  endTime: string;
  overdue: boolean;
};

/** Class guests belong to their class cell; individual experiments occupy their own time slot. */
export async function individualExperimentalSessions(
  context: RecordContext,
  input: z.infer<typeof classRecordListSchema>,
): Promise<IndividualSession[]> {
  if (input.classId) return [];
  const rows = await context.database.entryVisit.findMany({
    where: {
      kind: { in: ["INTRODUCTION", "PLACEMENT"] },
      deletedAt: null,
      candidate: { deletedAt: null },
      date: { gte: new Date(input.from), lte: new Date(input.to) },
      ...(context.staffUser.role === "TEACHER" ? { teacherId: context.staffUser.id } : {}),
    },
    select: individualSessionSelect,
    orderBy: [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }],
  });
  return rows.map((row) => ({
    ...row,
    date: dateOnly(row.date),
    startTime: timeOnly(row.startTime),
    endTime: timeOnly(row.endTime),
    overdue: row.status === "SCHEDULED" && sessionEndInstant(row) <= context.now,
  }));
}
