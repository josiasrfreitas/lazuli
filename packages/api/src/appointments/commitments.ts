import type { Prisma } from "@lazuli/db";
import { intervalsOverlap, weekdayOf } from "@lazuli/domain";
import { dateOnly, timeOnly } from "../class-records/data.js";
import { badRequest } from "../trpc/errors.js";

type IndependentAppointment = Pick<
  Prisma.PedagogicalAppointmentGetPayload<true>,
  "id" | "studentId" | "purpose" | "status" | "format"
> & {
  studentName: string;
  rescheduledToId: string | null;
  date: string;
  startTime: string;
  endTime: string;
};

/** Independent appointments occupy teaching time; class guests already occupy their class slot. */
export async function independentAppointments(input: {
  database: Prisma.TransactionClient;
  teacherId: string;
  from: string;
  through: string;
}): Promise<IndependentAppointment[]> {
  const rows = await input.database.pedagogicalAppointment.findMany({
    where: {
      teacherId: input.teacherId,
      targetClassSessionId: null,
      deletedAt: null,
      date: { gte: new Date(input.from), lte: new Date(input.through) },
    },
    include: { student: { select: { fullName: true } }, rescheduledTo: { select: { id: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    studentName: row.student.fullName,
    purpose: row.purpose,
    status: row.status,
    rescheduledToId: row.rescheduledTo?.id ?? null,
    format: row.format,
    date: dateOnly(row.date),
    startTime: timeOnly(row.startTime),
    endTime: timeOnly(row.endTime),
  }));
}
export async function assertNoAppointmentConflict(input: {
  database: Prisma.TransactionClient;
  teacherId: string;
  from: string;
  through: string;
  slots: readonly { weekday: string; startTime: string; endTime: string }[];
  candidateMeetings?: readonly { date: string; startTime: string; endTime: string }[];
  excludeAppointmentId?: string;
}): Promise<void> {
  const appointments = await independentAppointments(input);
  for (const row of appointments) {
    if (row.status === "CANCELLED" || row.id === input.excludeAppointmentId) continue;
    const overlaps = input.candidateMeetings
      ? input.candidateMeetings.some(
          (item) => item.date === row.date && intervalsOverlap(item, row),
        )
      : input.slots.some(
          (item) => item.weekday === weekdayOf(row.date) && intervalsOverlap(item, row),
        );
    if (overlaps)
      throw badRequest(
        `Conflito com atendimento em ${row.date.split("-").toReversed().join("/")}, ${row.startTime}–${row.endTime}.`,
      );
  }
}
