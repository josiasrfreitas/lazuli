import type { Prisma } from "@lazuli/db";
import { meetingsBetween } from "../teachers/schedule.js";
import type { AppointmentContext } from "./data.js";

type Appointment = Prisma.PedagogicalAppointmentGetPayload<object>;
export type AvailabilityInput = {
  teacherId: string;
  studentId: string;
  week: string;
  through?: string | undefined;
  excludeAppointmentId?: string | undefined;
};
export type AvailabilityData = {
  meetings: Awaited<ReturnType<typeof meetingsBetween>>;
  enrollments: { classId: string; entryDate: Date; exitDate: Date | null }[];
  appointments: Pick<
    Appointment,
    "id" | "date" | "startTime" | "endTime" | "teacherId" | "studentId" | "targetClassSessionId"
  >[];
  closedDays: { date: Date; reason: string }[];
  sessions: { id: string }[];
};
const appointmentSelect = {
  id: true,
  date: true,
  startTime: true,
  endTime: true,
  teacherId: true,
  studentId: true,
  targetClassSessionId: true,
} as const;

export async function availabilityData(
  context: AppointmentContext,
  values: AvailabilityRange,
): Promise<AvailabilityData> {
  const { input, from, through } = values;
  const { database } = context;
  const range = { gte: new Date(from), lte: new Date(through) };
  const [meetings, enrollments, appointments, closedDays, sessions] = await Promise.all([
    meetingsBetween({ database, from, through, now: context.now }),
    database.enrollment.findMany({
      where: {
        studentId: input.studentId,
        deletedAt: null,
        entryDate: { lte: range.lte },
        OR: [{ exitDate: null }, { exitDate: { gt: range.gte } }],
      },
      select: { classId: true, entryDate: true, exitDate: true },
    }),
    database.pedagogicalAppointment.findMany({
      where: {
        date: range,
        deletedAt: null,
        status: { not: "CANCELLED" },
        ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
        OR: [
          { teacherId: input.teacherId, targetClassSessionId: null },
          { studentId: input.studentId },
        ],
      },
      select: appointmentSelect,
    }),
    database.schoolClosedDay.findMany({
      where: { date: range, deletedAt: null },
      select: { date: true, reason: true },
    }),
    database.classSession.findMany({
      where: {
        date: range,
        status: "SCHEDULED",
        deletedAt: null,
        class: { status: "ACTIVE", deletedAt: null },
      },
      select: { id: true },
    }),
  ]);
  return { meetings, enrollments, appointments, closedDays, sessions };
}

type AvailabilityRange = { input: AvailabilityInput; from: string; through: string };
