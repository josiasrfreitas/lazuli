import { createHash, randomBytes } from "node:crypto";
import { sessionEndInstant } from "../../packages/domain/src/session-time.js";

export type AttendanceScenario = {
  classKey: string;
  declarations: number;
  kind: "FAMILY_NAME" | "SUBSTITUTE" | "EXPIRED" | "ONLINE" | "MANUAL_CLOSE" | "ROTATED";
  ttl: 10 | 20 | 30;
};

export const ATTENDANCE_SCENARIOS: readonly AttendanceScenario[] = [
  { classKey: "MWYB", declarations: 6, kind: "FAMILY_NAME", ttl: 20 },
  { classKey: "PPT-E1", declarations: 6, kind: "SUBSTITUTE", ttl: 30 },
  { classKey: "F1A", declarations: 5, kind: "EXPIRED", ttl: 10 },
  { classKey: "S2A", declarations: 5, kind: "ONLINE", ttl: 20 },
  { classKey: "MWBA", declarations: 4, kind: "MANUAL_CLOSE", ttl: 20 },
  { classKey: "PPT-C2", declarations: 5, kind: "ROTATED", ttl: 20 },
];

const MINUTE_MS = 60_000;
const TOKEN_BYTES = 32;
// A synthetic coordinate grid, not the school's address or a real attendance measurement.
const SYNTHETIC_LATITUDE = -9.6;
const SYNTHETIC_LONGITUDE = -35.75;
const LOCATION_ACCURACIES = [12, 25, 65, 180];

export function minutesAfter(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MINUTE_MS);
}

/** Historical credentials are deliberately unrecoverable; no usable token leaves this function. */
export function historicalTokenHash(): string {
  return createHash("sha256").update(randomBytes(TOKEN_BYTES).toString("base64url")).digest("hex");
}

export function encounterWindow(
  session: { date: Date; startTime: Date; endTime: Date; attendanceConfirmedAt: Date },
  scenario: AttendanceScenario,
): { openedAt: Date; expiresAt: Date; closedAt: Date } {
  const start = sessionEndInstant({ date: session.date, endTime: session.startTime });
  const end = sessionEndInstant(session);
  const openedAt =
    scenario.kind === "MANUAL_CLOSE"
      ? minutesAfter(end, -7)
      : minutesAfter(start, scenario.kind === "EXPIRED" ? 0 : -5);
  return {
    openedAt,
    expiresAt: new Date(Math.min(minutesAfter(openedAt, scenario.ttl).getTime(), end.getTime())),
    closedAt:
      scenario.kind === "MANUAL_CLOSE" ? minutesAfter(end, -1) : session.attendanceConfirmedAt,
  };
}

export function referenceLocation(online: boolean, includeReference: boolean) {
  return {
    referenceLatitude: online || !includeReference ? null : SYNTHETIC_LATITUDE,
    referenceLongitude: online || !includeReference ? null : SYNTHETIC_LONGITUDE,
    referenceAccuracy: online || !includeReference ? null : 15,
  };
}

export function declarationLocation(online: boolean, submittedAt: Date, variation: number) {
  // Precision and distance vary for teacher review; neither decides the final attendance.
  const offset = variation % LOCATION_ACCURACIES.length === 3 ? 0.004 : variation * 0.00003;
  return {
    latitude: online ? null : SYNTHETIC_LATITUDE + offset,
    longitude: online ? null : SYNTHETIC_LONGITUDE - offset,
    accuracy: online ? null : LOCATION_ACCURACIES[variation % LOCATION_ACCURACIES.length]!,
    capturedAt: online ? null : new Date(submittedAt.getTime() - 5_000),
  };
}
