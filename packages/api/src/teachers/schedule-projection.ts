import { sessionEndInstant, teachingMinutes, type TeacherCommitment } from "@lazuli/domain";
import { dateToTimeString } from "../classes/time.js";
import { usualTeacherOn } from "./responsibility.js";
import type { ScheduleClass, ScheduleSession, ScheduleSubstitution } from "./schedule-data.js";

export type TeacherMeeting = TeacherCommitment & {
  sessionId: string | null;
  className: string;
  classCode: string;
  scheduleType: "REGULAR" | "PERSONALIZED";
  format: "IN_PERSON" | "ONLINE";
  stageName: string | null;
  usualTeacherName: string | null;
  substituteTeacherName: string | null;
  minutes: number;
  editable: boolean;
};
export type MeetingCandidate = {
  classRow: ScheduleClass;
  date: string;
  slotId: string | null;
  sessionId: string | null;
  start: Date;
  end: Date;
};
export type ProjectionContext = {
  closed: Set<string>;
  sessions: Map<string, ScheduleSession>;
  substitutions: Map<string, ScheduleSubstitution>;
  now: Date;
};
export function meetingKey(row: {
  classId: string;
  slotId: string | null;
  sessionId?: string | null;
  date: string;
}): string {
  return `${row.classId}:${row.slotId ?? row.sessionId}:${row.date}`;
}
function hasAttendance(session: ScheduleSession | undefined): boolean {
  return Boolean(
    session?.attendanceConfirmedAt ||
    session?.attendanceLastCommittedAt ||
    session?._count.attendanceRows,
  );
}
function activeSubstitute(input: {
  substitution: ScheduleSubstitution | undefined;
  session: ScheduleSession | undefined;
  date: string;
}): ScheduleSubstitution | null {
  const { substitution, session, date } = input;
  if (!substitution || substitution.revokedAt) return null;
  const departure = substitution.teacher.teacherProfile?.departureDate;
  if (!departure || new Date(date) < departure || session?.responsibilityFrozenAt)
    return substitution;
  return null;
}
function meetingTeachers(
  candidate: MeetingCandidate,
  input: {
    session: ScheduleSession | undefined;
    substitution: ScheduleSubstitution | undefined;
  },
): Pick<
  TeacherMeeting,
  "usualTeacherId" | "usualTeacherName" | "substituteTeacherId" | "substituteTeacherName"
> {
  const usual = input.session?.responsibilityFrozenAt
    ? input.session.usualTeacher
    : usualTeacherOn(candidate.classRow, new Date(candidate.date));
  const substitute = substituteIdentity(activeSubstitute({ ...input, date: candidate.date }));
  const identity = teacherIdentity(usual);
  return {
    usualTeacherId: identity.id,
    usualTeacherName: identity.name,
    substituteTeacherId: substitute.id,
    substituteTeacherName: substitute.name,
  };
}
function meetingTimes(
  candidate: MeetingCandidate,
  session: ScheduleSession | undefined,
): Pick<TeacherMeeting, "sessionId" | "startTime" | "endTime"> {
  return {
    sessionId: session?.id ?? candidate.sessionId,
    startTime: dateToTimeString(session?.startTime ?? candidate.start),
    endTime: dateToTimeString(session?.endTime ?? candidate.end),
  };
}
function classMetadata(
  row: ScheduleClass,
): Pick<TeacherMeeting, "className" | "classCode" | "scheduleType" | "format" | "stageName"> {
  return {
    className: row.portalClassName,
    classCode: row.internalCode,
    scheduleType: row.scheduleType,
    format: row.format,
    stageName: row.sharedStage?.name ?? null,
  };
}
export function projectMeeting(
  candidate: MeetingCandidate,
  context: ProjectionContext,
): TeacherMeeting | null {
  const { classRow, slotId, sessionId, date } = candidate;
  const key = meetingKey({ classId: classRow.id, slotId, sessionId, date });
  const session = context.sessions.get(key);
  if (session?.status === "CANCELLED" || session?.deletedAt) return null;
  const recorded = hasAttendance(session);
  if (context.closed.has(date) && !recorded) return null;
  const substitution = context.substitutions.get(key);
  const row: TeacherMeeting = {
    classId: classRow.id,
    slotId,
    date,
    ...meetingTimes(candidate, session),
    ...meetingTeachers(candidate, { session, substitution }),
    ...classMetadata(classRow),
    requiresCoverage: Boolean(substitution?.revokedAt && !substitution.coverageResolvedAt),
    cancelled: false,
    minutes: 0,
    editable: false,
  };
  row.minutes = teachingMinutes(row);
  row.editable = !recorded && sessionEndInstant({ date, endTime: row.startTime }) > context.now;
  return row;
}

function teacherIdentity(teacher: { id: string; name: string } | null | undefined): {
  id: string | null;
  name: string | null;
} {
  if (!teacher) return { id: null, name: null };
  return { id: teacher.id, name: teacher.name };
}
function substituteIdentity(substitute: ScheduleSubstitution | null): {
  id: string | null;
  name: string | null;
} {
  if (!substitute) return { id: null, name: null };
  return { id: substitute.teacherId, name: substitute.teacher.name };
}
