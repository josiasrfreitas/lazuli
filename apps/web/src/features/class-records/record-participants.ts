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
      status:
        recorded || recordedIds.has(row.enrollmentId)
          ? row.status === "PRESENT"
            ? "present"
            : "absent"
          : "pending",
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
      status:
        guest.status === "ATTENDED"
          ? "present"
          : guest.status === "NO_SHOW"
            ? "absent"
            : guest.status === "CANCELLED"
              ? "cancelled"
              : "pending",
      colorKey: guest.student.id,
    }),
  );
  const experiments = data.leadGuests.map(
    (visit): LessonParticipant => ({
      key: `experimental-${visit.id}`,
      id: visit.id,
      name: visit.candidate.fullName,
      description: "Convidado · Aula experimental",
      kind: "experimental",
      status:
        visit.status === "ATTENDED"
          ? "present"
          : visit.status === "ABSENT"
            ? "absent"
            : visit.status === "CANCELLED"
              ? "cancelled"
              : "pending",
      colorKey: visit.candidate.studentId ?? visit.candidate.id,
    }),
  );
  const rank: Record<ParticipantStatus, number> = {
    absent: 0,
    present: 1,
    pending: 2,
    cancelled: 3,
  };
  return [...students, ...appointments, ...experiments].toSorted(
    (left, right) =>
      rank[left.status] - rank[right.status] || left.name.localeCompare(right.name, "pt-BR"),
  );
}
