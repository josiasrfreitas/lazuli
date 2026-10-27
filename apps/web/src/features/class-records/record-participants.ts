import { purposes } from "~/features/appointments/shared";
import type { ClassRecord } from "./shared";

export type ParticipantStatus = "absent" | "present" | "pending" | "cancelled";
export type LessonParticipant = {
  key: string;
  id: string;
  name: string;
  description: string;
  kind: "student" | "appointment" | "experimental";
  status: ParticipantStatus;
  colorKey: string;
};

const participantRank: Record<ParticipantStatus, number> = {
  absent: 0,
  present: 1,
  pending: 2,
  cancelled: 3,
};

function studentStatus(status: string, attendanceRecorded: boolean): ParticipantStatus {
  if (!attendanceRecorded) return "pending";
  return status === "PRESENT" ? "present" : "absent";
}

function guestStatus(status: string): ParticipantStatus {
  if (status === "ATTENDED") return "present";
  if (status === "NO_SHOW" || status === "ABSENT") return "absent";
  if (status === "CANCELLED") return "cancelled";
  return "pending";
}

export function lessonParticipants(data: ClassRecord): LessonParticipant[] {
  const recordedIds = new Set(data.recordedAttendanceIds);
  const recorded = data.version > 0 || data.attendanceOnly;
  const students = data.snapshot.entries.map((row): LessonParticipant => ({
    key: `enrollment-${row.enrollmentId}`,
    id: row.studentId,
    name: row.name,
    description:
      data.session.scheduleType === "PERSONALIZED" && row.stage
        ? `Aluno da turma · ${row.stage}`
        : "Aluno da turma",
    kind: "student",
    status: studentStatus(row.status, recorded || recordedIds.has(row.enrollmentId)),
    colorKey: row.studentId,
  }));
  const appointments = data.guests.map((guest): LessonParticipant => ({
    key: `appointment-${guest.id}`,
    id: guest.id,
    name: guest.student.fullName,
    description: `Convidado · ${purposes[guest.purpose]}`,
    kind: "appointment",
    status: guestStatus(guest.status),
    colorKey: guest.student.id,
  }));
  const experiments = data.leadGuests.map((visit): LessonParticipant => ({
    key: `experimental-${visit.id}`,
    id: visit.id,
    name: visit.candidate.fullName,
    description: "Convidado · Aula experimental",
    kind: "experimental",
    status: guestStatus(visit.status),
    colorKey: visit.candidate.studentId ?? visit.candidate.id,
  }));
  return [...students, ...appointments, ...experiments].toSorted(
    (left, right) =>
      participantRank[left.status] - participantRank[right.status] ||
      left.name.localeCompare(right.name, "pt-BR"),
  );
}
