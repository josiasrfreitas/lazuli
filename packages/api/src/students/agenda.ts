import { intersectEnrollmentSemesterWindows, sessionEndInstant } from "@lazuli/domain";
import type { RecordContext } from "../class-records/data.js";
import { listClassRecords } from "../class-records/read.js";
import { listAppointments } from "../appointments/read.js";
import { notFound } from "../trpc/errors.js";
import { STUDENT_NOT_FOUND_MESSAGE } from "./errors.js";
import { meetingKey, meetingsBetween } from "../teachers/schedule.js";
import { dateOnly } from "../class-records/data.js";

/** Membership windows keep other classes and lessons outside the student's enrollment out. */
export async function readStudentAgenda(
  context: RecordContext,
  input: {
    id: string;
    from: string;
    to: string;
  },
) {
  const student = await context.database.student.findFirst({
    where: { id: input.id, deletedAt: null },
    select: { id: true },
  });
  if (!student) throw notFound(STUDENT_NOT_FOUND_MESSAGE);
  const enrollments = await context.database.enrollment.findMany({
    where: {
      studentId: input.id,
      deletedAt: null,
      class: { deletedAt: null },
      entryDate: { lte: new Date(input.to) },
      OR: [{ exitDate: null }, { exitDate: { gt: new Date(input.from) } }],
    },
    select: {
      classId: true,
      entryDate: true,
      exitDate: true,
      class: { select: { semester: { select: { startDate: true, endDate: true } } } },
    },
  });
  const windows = enrollments.flatMap((enrollment) => {
    const window = intersectEnrollmentSemesterWindows({
      enrollment,
      semester: enrollment.class.semester,
    });
    return window
      ? [
          {
            classId: enrollment.classId,
            date: {
              gte: window.startDate,
              lte: window.endDate,
              ...(enrollment.exitDate ? { lt: enrollment.exitDate } : {}),
            },
          },
        ]
      : [];
  });
  const [recordedLessons, appointments, meetings] = await Promise.all([
    windows.length ? listClassRecords(context, input, { OR: windows }) : [],
    listAppointments(context, { from: input.from, through: input.to, studentId: input.id }),
    windows.length
      ? meetingsBetween({
          database: context.database,
          from: input.from,
          through: input.to,
          now: context.now,
        })
      : [],
  ]);
  const projected = meetings.filter(
    (meeting) =>
      !meeting.sessionId &&
      windows.some(
        (window) =>
          window.classId === meeting.classId &&
          meeting.date >= dateOnly(window.date.gte) &&
          meeting.date <= dateOnly(window.date.lte) &&
          (!window.date.lt || meeting.date < dateOnly(window.date.lt)),
      ),
  );
  const lessons = [
    ...recordedLessons.map((lesson) => ({ ...lesson, sessionId: lesson.id })),
    ...projected.map((meeting) => ({
      id: meetingKey(meeting),
      sessionId: null,
      classId: meeting.classId,
      className: meeting.className,
      scheduleType: meeting.scheduleType,
      format: meeting.format,
      stageName: meeting.stageName,
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      teacher: meeting.substituteTeacherName ?? meeting.usualTeacherName,
      state:
        sessionEndInstant(meeting) > context.now ? ("UPCOMING" as const) : ("PENDING" as const),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  return { lessons, appointments };
}
