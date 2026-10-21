import type { ClassRecordSnapshot } from "@lazuli/validators";

export type SessionSummary = {
  id: string;
  classId: string;
  className: string;
  stageName: string | null;
  scheduleType: "REGULAR" | "PERSONALIZED";
  format: "IN_PERSON" | "ONLINE";
  date: string;
  startTime: string;
  endTime: string;
  teacherId: string | null;
  teacher: string | null;
  state: "CANCELLED" | "RECORDED" | "UPCOMING" | "PENDING";
  attendanceOnly: boolean;
};
export type ClassRecordDetail = {
  session: Omit<SessionSummary, "state" | "attendanceOnly"> & {
    cancelled: boolean;
    upcoming: boolean;
    cancelReason: string | null;
    usualTeacher: string | null;
  };
  recordedAttendanceIds: string[];
  declarations: { id: string; enrollmentId: string; submittedAt: Date }[];
  hasAttendanceWindows: boolean;
  version: number;
  recordedAt: Date | null;
  attendanceStamp: string | null;
  attendanceOnly: boolean;
  attendanceReadOnly: boolean;
  restriction: string | null;
  snapshot: ClassRecordSnapshot;
};
export type ClassRecordRevision = {
  id: string;
  version: number;
  reason: string;
  author: string;
  authorId: string | null;
  recordedAt: Date;
  snapshot: ClassRecordSnapshot;
};
export type RevisionPage<T> = { items: T[]; nextCursor: number | undefined };
export type VersionedResult = { id: string; version: number };
