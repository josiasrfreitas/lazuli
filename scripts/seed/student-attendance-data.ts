import { createHash, randomBytes } from "node:crypto";
import { sessionEndInstant } from "../../packages/domain/src/session-time.js";

const ENCOUNTER_TTLS = { SHORT: 10, STANDARD: 20, LONG: 30 } as const;
const LOCATION_ACCURACY = { PRECISE: 12, NEAR: 25, BROAD: 65, DISTANT: 180 } as const;
const MANUAL_OPEN_MINUTES_BEFORE_END = 7;
const EARLY_OPEN_MINUTES = 5;
const REFERENCE_ACCURACY = 15;
const IN_PERSON_WINDOW_MINUTES = 5;
const SYNTHETIC_RADIUS_METERS = 100;
const SYNTHETIC_MAX_ACCURACY_METERS = 100;
const DISTANT_VARIATION_INDEX = 3;
const DISTANT_LOCATION_OFFSET = 0.004;
const NEAR_LOCATION_OFFSET_INCREMENT = 0.000_03;
const CAPTURE_AGE_MS = 5000;

export type AttendanceScenario = {
  classKey: string;
  declarations: number;
  kind: "FAMILY_NAME" | "SUBSTITUTE" | "EXPIRED" | "ONLINE" | "MANUAL_CLOSE" | "ROTATED";
  ttl: (typeof ENCOUNTER_TTLS)[keyof typeof ENCOUNTER_TTLS];
};

export const ATTENDANCE_SCENARIOS: readonly AttendanceScenario[] = [
  { classKey: "MWYB", declarations: 6, kind: "FAMILY_NAME", ttl: ENCOUNTER_TTLS.STANDARD },
  { classKey: "PPT-E1", declarations: 6, kind: "SUBSTITUTE", ttl: ENCOUNTER_TTLS.LONG },
  { classKey: "F1A", declarations: 5, kind: "EXPIRED", ttl: ENCOUNTER_TTLS.SHORT },
  { classKey: "S2A", declarations: 5, kind: "ONLINE", ttl: ENCOUNTER_TTLS.STANDARD },
  { classKey: "MWBA", declarations: 4, kind: "MANUAL_CLOSE", ttl: ENCOUNTER_TTLS.STANDARD },
  { classKey: "PPT-C2", declarations: 5, kind: "ROTATED", ttl: ENCOUNTER_TTLS.STANDARD },
];

const MINUTE_MS = 60_000;
const TOKEN_BYTES = 32;
// A synthetic coordinate grid, not the school's address or a real attendance measurement.
const SYNTHETIC_LATITUDE = -9.6;
const SYNTHETIC_LONGITUDE = -35.75;
const LOCATION_ACCURACIES = [
  LOCATION_ACCURACY.PRECISE,
  LOCATION_ACCURACY.NEAR,
  LOCATION_ACCURACY.BROAD,
  LOCATION_ACCURACY.DISTANT,
];

export function minutesAfter(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MINUTE_MS);
}

/** Historical credentials are deliberately unrecoverable; no usable token leaves this function. */
export function historicalTokenHash(): string {
  return createHash("sha256").update(randomBytes(TOKEN_BYTES).toString("base64url")).digest("hex");
}

export function encounterWindow(
  session: {
    date: Date;
    startTime: Date;
    endTime: Date;
    attendanceConfirmedAt: Date;
    class: { format: string };
  },
  scenario: AttendanceScenario,
): { openedAt: Date; expiresAt: Date; closedAt: Date } {
  const start = sessionEndInstant({ date: session.date, endTime: session.startTime });
  const end = sessionEndInstant(session);
  const openedAt =
    scenario.kind === "MANUAL_CLOSE"
      ? minutesAfter(end, -MANUAL_OPEN_MINUTES_BEFORE_END)
      : minutesAfter(start, scenario.kind === "EXPIRED" ? 0 : -EARLY_OPEN_MINUTES);
  return {
    openedAt,
    expiresAt: new Date(
      Math.min(
        minutesAfter(
          openedAt,
          session.class.format === "IN_PERSON" ? IN_PERSON_WINDOW_MINUTES : scenario.ttl,
        ).getTime(),
        end.getTime(),
      ),
    ),
    closedAt:
      scenario.kind === "MANUAL_CLOSE" ? minutesAfter(end, -1) : session.attendanceConfirmedAt,
  };
}

export function referenceLocation(online: boolean): {
  referenceLatitude: number | null;
  referenceLongitude: number | null;
  referenceAccuracy: number | null;
  radiusMeters: number | null;
  maxAccuracyMeters: number | null;
} {
  return {
    referenceLatitude: online ? null : SYNTHETIC_LATITUDE,
    referenceLongitude: online ? null : SYNTHETIC_LONGITUDE,
    referenceAccuracy: online ? null : REFERENCE_ACCURACY,
    radiusMeters: online ? null : SYNTHETIC_RADIUS_METERS,
    maxAccuracyMeters: online ? null : SYNTHETIC_MAX_ACCURACY_METERS,
  };
}

export function declarationLocation({
  online,
  submittedAt,
  variation,
}: {
  online: boolean;
  submittedAt: Date;
  variation: number;
}): {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  capturedAt: Date | null;
} {
  // Precision and distance vary for teacher review; neither decides the final attendance.
  const offset =
    variation % LOCATION_ACCURACIES.length === DISTANT_VARIATION_INDEX
      ? DISTANT_LOCATION_OFFSET
      : variation * NEAR_LOCATION_OFFSET_INCREMENT;
  return {
    latitude: online ? null : SYNTHETIC_LATITUDE + offset,
    longitude: online ? null : SYNTHETIC_LONGITUDE - offset,
    accuracy: online ? null : LOCATION_ACCURACIES[variation % LOCATION_ACCURACIES.length]!,
    capturedAt: online ? null : new Date(submittedAt.getTime() - CAPTURE_AGE_MS),
  };
}
