import type { Prisma } from "@lazuli/db";
import { calendarCapacity } from "./capacity.js";
import { calendarChangeState } from "./change-state.js";
import { civil } from "./change-dates.js";
import type { CalendarChange } from "./change-schema.js";
import { readCalendarImpact } from "./impact-read.js";
import { selectImpactCandidates } from "./impact-selection.js";
import {
  impactEntry,
  impactSubject,
  impactFingerprint,
  type CalendarChangePreview,
} from "./impact-evidence.js";
export async function previewCalendarChange(
  database: Prisma.TransactionClient,
  input: { change: CalendarChange; now: Date },
): Promise<CalendarChangePreview> {
  const { change, now } = input;
  const state = await calendarChangeState(database, change);
  const [sessions, appointments, visits, plannedItems] = await readCalendarImpact(database, state);
  const rows = { sessions, appointments, visits, plannedItems };
  const candidates = selectImpactCandidates(rows, { state, change, now });
  const {
    sessionCandidates,
    appointmentCandidates,
    visitCandidates,
    cancellableSessions,
    cancellableAppointments,
    cancellableVisits,
    plans,
  } = candidates;
  const capacity = await calendarCapacity(database, state);
  const releasedDates = state.closedDays
    .filter(
      (row) =>
        civil(row.date) >= state.from &&
        civil(row.date) <= state.through &&
        !state.closed.has(civil(row.date)),
    )
    .map((row) => civil(row.date));
  return {
    subject: impactSubject(change, state),
    fingerprint: impactFingerprint({ rows, state, change, capacity }, candidates),
    from: state.from,
    through: state.through,
    sessions: cancellableSessions.map((row) => ({
      ...impactEntry(row, row.class.portalClassName),
      classId: row.classId,
    })),
    appointments: cancellableAppointments.map((row) => impactEntry(row, row.student.fullName)),
    visits: cancellableVisits.map((row) => impactEntry(row, row.candidate.fullName)),
    preserved:
      sessionCandidates.filter((row) => row.status !== "CANCELLED").length -
      cancellableSessions.length +
      appointmentCandidates.filter((row) => row.status !== "CANCELLED").length -
      cancellableAppointments.length +
      visitCandidates.filter((row) => row.status !== "CANCELLED").length -
      cancellableVisits.length,
    plans: plans.map((row) => ({
      id: row.id,
      title: row.title,
      date: civil(row.plannedOn),
      classId: row.plan.classId,
      name: row.plan.class?.portalClassName ?? row.plan.student?.fullName ?? "Plano individual",
    })),
    releasedDates,
    capacity,
  };
}
