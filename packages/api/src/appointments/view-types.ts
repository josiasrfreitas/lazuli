import type { AppointmentSnapshot } from "@lazuli/validators";
import type { Student, Prisma } from "@lazuli/db";

export type AppointmentResult = { id: string; version: number };
export type AppointmentSummary = AppointmentSnapshot & {
  restriction: string | null;
  destinationCancelled: boolean;
  overdue: boolean;
  rescheduledToId: string | null;
};
export type AppointmentDetail = {
  snapshot: AppointmentSnapshot;
  restriction: string | null;
  rescheduledToId: string | null;
  absences: AbsenceView[];
  history: {
    id: string;
    version: number;
    author: { id: string; name: string } | null;
    at: Date;
    kind: string;
    reason: string | null;
    snapshot: AppointmentSnapshot;
  }[];
};
export type ResolvedMeeting = {
  teacherId: string;
  student: Student;
  date: Date;
  startTime: Date;
  endTime: Date;
  format: AppointmentSnapshot["format"];
  targetClassSessionId: string | null;
};
export type AppointmentStudentOptions = {
  student: { id: string; fullName: string };
  hasCurrentEnrollment: boolean;
  defaultTeacher: { id: string; name: string } | null;
  absences: AbsenceView[];
  enrollments: {
    id: string;
    className: string;
    scheduleType: "REGULAR" | "PERSONALIZED";
    entryDate: string;
    exitDate: string | null;
  }[];
};
export type LegacyAppointment = Prisma.PedagogicalAppointmentGetPayload<object>;

export type AbsenceView = {
  id: string;
  studentId: string;
  studentName: string;
  enrollmentId: string;
  classId: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  compensated: number;
  reserved: number;
  available: number;
  content: {
    account: string;
    kind: "ASSESSMENT" | "CONTENT" | "REVIEW" | "ACTIVITY";
    reference: string | null;
    pageFrom: number | null;
    pageTo: number | null;
    planItemId?: string | null | undefined;
    planItemStatus?: "COMPLETED" | "PARTIAL" | undefined;
    planItemTitle?: string | undefined;
  } | null;
};

export type IndependentAppointments = {
  id: string;
  studentId: string;
  studentName: string;
  purpose: AppointmentSnapshot["purpose"];
  status: AppointmentSnapshot["status"];
  format: AppointmentSnapshot["format"];
  date: string;
  startTime: string;
  endTime: string;
}[];

export type AppointmentDestinations = {
  id: string;
  date: string;
  classId: string;
  name: string;
  startTime: string;
  endTime: string;
  teacher: { id: string; name: string } | null;
  format: AppointmentSnapshot["format"];
  scheduleType: "REGULAR" | "PERSONALIZED";
}[];

export type AppointmentAvailability = {
  classes: {
    id: string;
    sessionId: string | null;
    classId: string;
    className: string;
    scheduleType: "REGULAR" | "PERSONALIZED";
    stageName: string | null;
    date: string;
    startTime: string;
    endTime: string;
    format: "IN_PERSON" | "ONLINE";
    selectable: boolean;
  }[];
  teacherBusy: { label: string; id: string; date: string; startTime: string; endTime: string }[];
  studentBusy: { id: string; date: string; startTime: string; endTime: string; label: string }[];
  closedDays: { date: string; reason: string }[];
};
