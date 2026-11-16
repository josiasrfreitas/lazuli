import type { AppointmentSnapshot } from "@lazuli/validators";
import { createAppointmentEvidence } from "@lazuli/db/appointment-evidence";
import type { AppointmentRow } from "./data.js";

export function appointmentSnapshot(row: AppointmentRow): AppointmentSnapshot {
  return createAppointmentEvidence(row);
}
