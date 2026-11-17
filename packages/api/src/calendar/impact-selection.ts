import { academicActivityCanBeCancelled } from "@lazuli/domain";
import { civil } from "./change-dates.js";
import { currentClosedDays } from "./change-projection.js";
import type { CalendarChangeState } from "./change-state.js";
import type { CalendarChange } from "./change-schema.js";
import type {
  ImpactRows,
  ImpactSession,
  ImpactAppointment,
  ImpactVisit,
  ImpactPlan,
} from "./impact-read.js";
export type ImpactCandidates = {
  sessionCandidates: ImpactSession[];
  appointmentCandidates: ImpactAppointment[];
  visitCandidates: ImpactVisit[];
  cancellableSessions: ImpactSession[];
  cancellableAppointments: ImpactAppointment[];
  cancellableVisits: ImpactVisit[];
  plans: ImpactPlan[];
};
export function selectImpactCandidates(
  rows: ImpactRows,
  context: { state: CalendarChangeState; change: CalendarChange; now: Date },
): ImpactCandidates {
  const { sessions, appointments, visits, plannedItems } = rows;
  const { state, change, now } = context;
  const outside = (semesterId: string, date: Date): boolean =>
    !state.proposedPeriods.some(
      (period) => period.id === semesterId && period.startDate <= date && period.endDate >= date,
    );
  const affectedSession = (row: ImpactSession): boolean =>
    state.closed.has(civil(row.date)) ||
    (change.action === "period" &&
      row.class.semesterId === change.id &&
      outside(row.class.semesterId, row.date));
  const affectedAppointment = (row: ImpactAppointment): boolean =>
    state.closed.has(civil(row.date)) ||
    (change.action === "period" &&
      row.targetClassSession !== null &&
      row.targetClassSession.class.semesterId === change.id &&
      outside(row.targetClassSession.class.semesterId, row.date));
  const affectedVisit = (row: ImpactVisit): boolean =>
    state.closed.has(civil(row.date)) ||
    (change.action === "period" &&
      row.class !== null &&
      row.class.semesterId === change.id &&
      outside(row.class.semesterId, row.date)) ||
    (change.action === "period" &&
      !row.class &&
      !state.proposedPeriods.some(
        (period) => period.startDate <= row.date && period.endDate >= row.date,
      ));
  const sessionCandidates = sessions.filter((row) => affectedSession(row));
  const appointmentCandidates = appointments.filter((row) => affectedAppointment(row));
  const visitCandidates = visits.filter((row) => affectedVisit(row));
  const cancellableSessions = sessionCandidates.filter((row) =>
    academicActivityCanBeCancelled({
      ...row,
      recorded: sessionRecorded(row),
      now,
    }),
  );
  const cancellableAppointments = appointmentCandidates.filter((row) =>
    academicActivityCanBeCancelled({
      ...row,
      recorded: Boolean(row.recordedAt || row.performedContent || row.performedMinutes),
      now,
    }),
  );
  const cancellableVisits = visitCandidates.filter((row) =>
    academicActivityCanBeCancelled({ ...row, recorded: Boolean(row.assessment), now }),
  );
  const previouslyClosed = currentClosedDays(state);
  const plans = plannedItems.filter(
    (row) =>
      (state.closed.has(civil(row.plannedOn)) && !previouslyClosed.has(civil(row.plannedOn))) ||
      (change.action === "period" &&
        row.plan.class !== null &&
        row.plan.class.semesterId === change.id &&
        state.period !== undefined &&
        row.plannedOn >= state.period.startDate &&
        row.plannedOn <= state.period.endDate &&
        outside(row.plan.class.semesterId, row.plannedOn)),
  );
  return {
    sessionCandidates,
    appointmentCandidates,
    visitCandidates,
    cancellableSessions,
    cancellableAppointments,
    cancellableVisits,
    plans,
  };
}
function sessionRecorded(row: ImpactSession): boolean {
  return Boolean(
    row.classRecord ||
    row.attendanceConfirmedAt ||
    row.attendanceLastCommittedAt ||
    row.portalSubmittedAt ||
    row._count.attendanceRows ||
    row._count.attendanceDeclarations ||
    row._count.attendanceWindows,
  );
}
