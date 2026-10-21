import { responsibleTeacherId, weekDates } from "@lazuli/domain";
import { dateOnly, timeOnly } from "../class-records/data.js";
import { meetingKey } from "../teachers/schedule.js";
import { requireAppointmentAdmin, type AppointmentContext } from "./data.js";
import {
  availabilityData,
  type AvailabilityInput,
  type AvailabilityData,
} from "./availability-data.js";
import type { AppointmentAvailability } from "./view-types.js";

/** Omitted through retains the Monday–Sunday range; an explicit through starts at week. */
export async function appointmentAvailability(
  context: AppointmentContext,
  input: AvailabilityInput,
): Promise<AppointmentAvailability> {
  requireAppointmentAdmin(context);
  const days = weekDates(input.week);
  const data = await availabilityData(context, {
    input,
    from: input.through ? input.week : days[0]!,
    through: input.through ?? days[6]!,
  });
  return availabilityView(data, input);
}

function studentMeetings(data: AvailabilityData): AvailabilityData["meetings"] {
  return data.meetings.filter(
    (row) =>
      !row.cancelled &&
      data.enrollments.some(
        (enrollment) =>
          enrollment.classId === row.classId &&
          dateOnly(enrollment.entryDate) <= row.date &&
          (!enrollment.exitDate || dateOnly(enrollment.exitDate) > row.date),
      ),
  );
}
function intervals(row: { id: string; date: Date; startTime: Date; endTime: Date }): {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
} {
  return {
    id: row.id,
    date: dateOnly(row.date),
    startTime: timeOnly(row.startTime),
    endTime: timeOnly(row.endTime),
  };
}
function availabilityView(
  data: AvailabilityData,
  input: AvailabilityInput,
): AppointmentAvailability {
  const availableSessions = new Set(data.sessions.map((row) => row.id));
  const teacherMeetings = data.meetings.filter(
    (row) => !row.cancelled && responsibleTeacherId(row) === input.teacherId,
  );
  return {
    classes: teacherMeetings.map((row) => ({
      id: row.sessionId ?? meetingKey(row),
      sessionId: row.sessionId,
      classId: row.classId,
      className: row.className,
      scheduleType: row.scheduleType,
      stageName: row.stageName,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      format: row.format,
      selectable: Boolean(row.editable && row.sessionId && availableSessions.has(row.sessionId)),
    })),
    teacherBusy: data.appointments
      .filter((row) => row.teacherId === input.teacherId && !row.targetClassSessionId)
      .map((row) => ({ ...intervals(row), label: "Atendimento" })),
    studentBusy: [
      ...studentMeetings(data).map((row) => ({
        id: row.sessionId ?? meetingKey(row),
        date: row.date,
        startTime: row.startTime,
        endTime: row.endTime,
        label: `Aula do aluno · ${row.className}`,
      })),
      ...data.appointments
        .filter((row) => row.studentId === input.studentId)
        .map((row) => ({ ...intervals(row), label: "Outro atendimento do aluno" })),
    ],
    closedDays: data.closedDays.map((row) => ({ date: dateOnly(row.date), reason: row.reason })),
  };
}
