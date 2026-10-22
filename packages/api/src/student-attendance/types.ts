import type { AttendanceNameCandidate } from "@lazuli/domain";
export type AttendanceFormat = "IN_PERSON" | "ONLINE";
export type SchoolLocation = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxAccuracyMeters: number;
};
export type AttendanceReceipt = { submittedAt: Date; name: string };
export type DeclarationReceipt = AttendanceReceipt & { repeated: boolean };
export type LinkInfo = {
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  format: AttendanceFormat;
  expiresAt: Date;
  sessionId: string;
};
export type OpenedWindow = { id: string; expiresAt: Date; token: string; projectionToken: string };
export type AttendanceStatus = {
  confirmationRestriction: string | null;
  sessionId: string;
  format: AttendanceFormat;
  restriction: string | null;
  windows: {
    id: string;
    openedAt: Date;
    expiresAt: Date;
    closedAt: Date | null;
    openedBy: { name: string };
    closedBy: { name: string } | null;
    active: boolean;
  }[];
  declarations: {
    id: string;
    enrollmentId: string;
    name: string;
    submittedAt: Date;
    matchKind: string;
    format: AttendanceFormat;
    accuracy: number | null;
    distance: number | null;
  }[];
};
export type RosterCandidate = AttendanceNameCandidate;
