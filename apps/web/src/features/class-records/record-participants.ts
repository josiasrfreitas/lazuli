import { purposes } from "~/features/appointments/shared";
import type { ClassRecord } from "./shared";
export type ParticipantStatus = "absent" | "present" | "pending" | "cancelled";
export type LessonParticipant = {
  key: string;
  id: string;
  name: string;
  description: string;
  kind: "student" | "appointment";
  status: ParticipantStatus;
  colorKey: string;
};
const rank: Record<ParticipantStatus, number> = { absent: 0, present: 1, pending: 2, cancelled: 3 };
export function lessonParticipants(data: ClassRecord): LessonParticipant[] {
  const recordedIds = new Set(data.recordedAttendanceIds);
  const recorded = data.version > 0 || data.attendanceOnly;
  const students = data.snapshot.entries.map(
    (row): LessonParticipant => ({
      key: `enrollment-${row.enrollmentId}`,
      id: row.studentId,
      name: row.name,
      description:
        data.session.scheduleType === "PERSONALIZED" && row.stage
          ? `Aluno da turma · ${row.stage}`
          : "Aluno da turma",
      kind: "student",
      status: rosterStatus(recorded || recordedIds.has(row.enrollmentId), row.status),
      colorKey: row.studentId,
    }),
  );
  const appointments = data.guests.map(
    (guest): LessonParticipant => ({
      key: `appointment-${guest.id}`,
      id: guest.id,
      name: guest.student.fullName,
      description: `Convidado · ${purposes[guest.purpose]}`,
      kind: "appointment",
      status: guestStatus(guest.status),
      colorKey: guest.student.id,
    }),
  );
  return [...students, ...appointments].toSorted(
    (left, right) =>
      rank[left.status] - rank[right.status] || left.name.localeCompare(right.name, "pt-BR"),
  );
}
function rosterStatus(recorded: boolean, status: string): ParticipantStatus {
  if (!recorded) return "pending";
  return status === "PRESENT" ? "present" : "absent";
}
function guestStatus(status: string): ParticipantStatus {
  if (status === "ATTENDED") return "present";
  if (status === "NO_SHOW") return "absent";
  return status === "CANCELLED" ? "cancelled" : "pending";
}
