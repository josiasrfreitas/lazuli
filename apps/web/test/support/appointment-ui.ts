import type { RouterOutputs } from "@lazuli/api";
export const appointmentId = "00000000-0000-4000-8000-000000000184";
export const studentId = "00000000-0000-4000-8000-000000000185";
export const teacherId = "00000000-0000-4000-8000-000000000186";
const enrollmentId = "00000000-0000-4000-8000-000000000187";
const absenceId = "00000000-0000-4000-8000-000000000188";
export const absence: RouterOutputs["appointments"]["student"]["absences"][number] = {
  id: absenceId,
  studentId,
  studentName: "Aluno de prova",
  enrollmentId,
  classId: "00000000-0000-4000-8000-000000000189",
  className: "Turma de origem",
  date: "2091-03-10",
  startTime: "14:00",
  endTime: "16:00",
  duration: 120,
  compensated: 0,
  reserved: 0,
  available: 120,
  content: null,
};
export const appointment: RouterOutputs["appointments"]["detail"] = {
  snapshot: {
    id: appointmentId,
    version: 1,
    student: { id: studentId, name: "Aluno de prova" },
    teacher: { id: teacherId, name: "Professora de prova" },
    enrollmentId,
    targetClassSessionId: null,
    targetClassName: null,
    legacyMakeupId: null,
    rescheduledFromId: null,
    purpose: "MAKEUP",
    status: "SCHEDULED",
    format: "IN_PERSON",
    date: "2091-04-01",
    startTime: "14:00",
    endTime: "16:00",
    plannedContent: "Prática de escuta",
    performedContent: null,
    performedMinutes: null,
    notes: null,
    scheduledAt: "2091-03-11T12:00:00Z",
    scheduledBy: { id: teacherId, name: "Responsável pelo agendamento" },
    recordedAt: null,
    recordedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    coverages: [
      {
        attendanceId: absenceId,
        minutes: 120,
        enrollmentId,
        sourceSessionId: "00000000-0000-4000-8000-000000000190",
        sourceClassId: absence.classId,
        sourceClassName: absence.className,
        date: absence.date,
        startTime: absence.startTime,
        endTime: absence.endTime,
        sourceStatus: "ABSENT",
        applicable: true,
      },
    ],
  },
  restriction: null,
  rescheduledToId: null,
  absences: [absence],
  history: [],
};
export const studentOptions: RouterOutputs["appointments"]["student"] = {
  student: { id: studentId, fullName: "Aluno de prova" },
  hasCurrentEnrollment: true,
  defaultTeacher: { id: teacherId, name: "Professora de prova" },
  absences: [absence],
  enrollments: [
    {
      id: enrollmentId,
      className: absence.className,
      scheduleType: "REGULAR",
      entryDate: "2091-02-01",
      exitDate: null,
    },
  ],
};
