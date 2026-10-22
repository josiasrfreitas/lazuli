import type { Prisma } from "@lazuli/db";
import { dateOnly, timeOnly } from "../class-records/data.js";

const appointmentSelect = {
  id: true,
  version: true,
  updatedAt: true,
  date: true,
  startTime: true,
  endTime: true,
  purpose: true,
  format: true,
  student: { select: { fullName: true } },
  teacher: {
    select: {
      id: true,
      deletedAt: true,
      teacherProfile: { select: { deletedAt: true, departureDate: true } },
    },
  },
} satisfies Prisma.PedagogicalAppointmentSelect;
type AppointmentRow = Prisma.PedagogicalAppointmentGetPayload<{ select: typeof appointmentSelect }>;
export type IndependentAppointment = Omit<
  AppointmentRow,
  "student" | "date" | "startTime" | "endTime"
> & { studentName: string; date: string; startTime: string; endTime: string };

export async function independentAppointments(
  database: Prisma.TransactionClient,
  input: { from: string; teacherId?: string },
): Promise<IndependentAppointment[]> {
  const rows = await database.pedagogicalAppointment.findMany({
    where: {
      deletedAt: null,
      status: "SCHEDULED",
      targetClassSessionId: null,
      date: { gte: new Date(input.from) },
      ...(input.teacherId ? { teacherId: input.teacherId } : {}),
    },
    select: appointmentSelect,
    orderBy: [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }],
  });
  return rows.map(({ student, date, startTime, endTime, ...row }) => ({
    ...row,
    studentName: student.fullName,
    date: dateOnly(date),
    startTime: timeOnly(startTime),
    endTime: timeOnly(endTime),
  }));
}

export function appointmentNeedsTeacher(row: IndependentAppointment): boolean {
  const teacher = row.teacher;
  if (!teacher || teacher.deletedAt || teacher.teacherProfile?.deletedAt) return true;
  const departureDate = teacher.teacherProfile?.departureDate;
  return Boolean(departureDate && dateOnly(departureDate) <= row.date);
}
