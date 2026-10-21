import type { Prisma } from "@lazuli/db";
import type { ResolvedMeeting } from "./view-types.js";
import { requireCurrentEnrollment } from "../enrollment/require-current.js";
import { intervalsOverlap, sessionEndInstant } from "@lazuli/domain";
import type { AppointmentScheduleInput } from "@lazuli/validators";
import {
  dateOnly,
  recordSessionInclude,
  responsibleTeacher,
  timeOnly,
} from "../class-records/data.js";
import { timeStringToDate } from "../classes/time.js";
import { assertNoTeacherConflict, assertTeacherEligible } from "../teachers/availability.js";
import { meetingsBetween } from "../teachers/schedule.js";
import { badRequest, notFound } from "../trpc/errors.js";
import type { AppointmentContext } from "./data.js";
export async function resolveAppointmentMeeting(
  context: AppointmentContext,
  input: AppointmentScheduleInput,
): Promise<ResolvedMeeting> {
  const { database, now } = context;
  const student = await database.student.findFirst({
    where: { id: input.studentId, deletedAt: null },
  });
  if (!student) throw notFound("Aluno não encontrado.");
  await requireCurrentEnrollment(context, input.studentId);
  const meeting = input.meeting;
  const session =
    meeting.kind === "CLASS"
      ? await database.classSession.findFirst({
          where: {
            id: meeting.sessionId,
            deletedAt: null,
            class: { deletedAt: null, status: "ACTIVE" },
          },
          include: recordSessionInclude,
        })
      : null;
  if (meeting.kind === "CLASS" && (!session || session.status === "CANCELLED"))
    throw badRequest("A aula de destino não está disponível.");
  const values = meetingValues({ session, meeting });
  if (!values?.teacherId) throw badRequest("Defina um professor responsável pelo atendimento.");
  if (sessionEndInstant({ date: values.date, endTime: values.startTime }) <= now)
    throw badRequest("Escolha um horário que ainda não começou.");
  const date = dateOnly(values.date);
  const candidate = {
    date,
    startTime: timeOnly(values.startTime),
    endTime: timeOnly(values.endTime),
  };
  await assertMeetingTeacher(context, {
    values: { ...values, teacherId: values.teacherId },
    session,
    date,
    candidate,
  });
  await assertMeetingEnrollment(context, { input, date: values.date });
  await assertStudentAvailable(context, {
    studentId: input.studentId,
    candidate: candidate,
  });
  return { ...values, teacherId: values.teacherId, student };
}
async function assertStudentAvailable(
  context: AppointmentContext,
  { studentId, candidate }: AssertStudentAvailableInput,
): Promise<void> {
  const { database } = context;
  const date = new Date(candidate.date);
  const [enrollments, appointments, meetings] = await Promise.all([
    database.enrollment.findMany({
      where: {
        studentId,
        deletedAt: null,
        entryDate: { lte: date },
        OR: [{ exitDate: null }, { exitDate: { gt: date } }],
      },
      select: { classId: true },
    }),
    database.pedagogicalAppointment.findMany({
      where: { studentId, date, deletedAt: null, status: { not: "CANCELLED" } },
    }),
    meetingsBetween({ database, from: candidate.date, through: candidate.date, now: context.now }),
  ]);
  const classIds = new Set(enrollments.map((row) => row.classId));
  const scheduledClass = meetings.find(
    (row) => !row.cancelled && classIds.has(row.classId) && intervalsOverlap(candidate, row),
  );
  if (scheduledClass)
    throw badRequest(
      `O aluno já tem aula em ${scheduledClass.classCode}, ${scheduledClass.startTime}–${scheduledClass.endTime}.`,
    );
  if (
    appointments.some((row) =>
      intervalsOverlap(candidate, {
        startTime: timeOnly(row.startTime),
        endTime: timeOnly(row.endTime),
      }),
    )
  )
    throw badRequest("O aluno já tem outro atendimento neste horário.");
}

type AssertStudentAvailableInput = {
  studentId: string;
  candidate: {
    date: string;
    startTime: string;
    endTime: string;
  };
};

type AppointmentSession = Prisma.ClassSessionGetPayload<{ include: typeof recordSessionInclude }>;
type MeetingValues = Omit<ResolvedMeeting, "student" | "teacherId"> & { teacherId: string | null };
function meetingValues({
  session,
  meeting,
}: {
  session: AppointmentSession | null;
  meeting: AppointmentScheduleInput["meeting"];
}): MeetingValues | null {
  if (session)
    return {
      teacherId: responsibleTeacher(session)?.id ?? null,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      format: session.class.format,
      targetClassSessionId: session.id,
    };
  if (meeting.kind === "INDEPENDENT")
    return {
      teacherId: meeting.teacherId,
      date: new Date(meeting.date),
      startTime: timeStringToDate(meeting.startTime),
      endTime: timeStringToDate(meeting.endTime),
      format: meeting.format,
      targetClassSessionId: null,
    };
  return null;
}
async function assertMeetingTeacher(
  context: AppointmentContext,
  { values, session, date, candidate }: AssertMeetingTeacherInput,
): Promise<void> {
  const { database } = context;
  const closed = await database.schoolClosedDay.findFirst({
    where: { date: values.date, deletedAt: null },
  });
  if (closed) throw badRequest(`A escola está fechada nesta data: ${closed.reason}.`);
  await assertTeacherEligible({ database, teacherId: values.teacherId, date });
  await assertNoTeacherConflict({
    database,
    teacherId: values.teacherId,
    from: date,
    through: date,
    slots: [],
    candidateMeetings: [candidate],
    ...(session
      ? {
          excludeMeeting: {
            classId: session.classId,
            slotId: session.scheduleSlotId,
            sessionId: session.id,
            date,
          },
        }
      : {}),
  });
}
async function assertMeetingEnrollment(
  context: AppointmentContext,
  { input, date }: { input: AppointmentScheduleInput; date: Date },
): Promise<void> {
  const { database } = context;
  if (input.enrollmentId) {
    const enrollment = await database.enrollment.findFirst({
      where: { id: input.enrollmentId, studentId: input.studentId, deletedAt: null },
      include: { class: true },
    });
    if (!enrollment) throw badRequest("A matrícula não pertence ao aluno.");
    if (
      input.purpose === "PPT_COMPLEMENT" &&
      (enrollment.class.scheduleType !== "PERSONALIZED" ||
        enrollment.entryDate > date ||
        (enrollment.exitDate && enrollment.exitDate <= date))
    )
      throw badRequest("Complemento PPT exige uma matrícula PPT vigente na data.");
  }
}

type AssertMeetingTeacherInput = {
  values: MeetingValues & { teacherId: string };
  session: AppointmentSession | null;
  date: string;
  candidate: { date: string; startTime: string; endTime: string };
};
