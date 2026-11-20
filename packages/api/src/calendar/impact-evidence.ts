import { createHash } from "node:crypto";
import type { calendarCapacity } from "./capacity.js";
import type { CalendarChange } from "./change-schema.js";
import type { CalendarChangeState } from "./change-state.js";
import { civil } from "./change-dates.js";
import type { ImpactRows } from "./impact-read.js";
import type { ImpactCandidates } from "./impact-selection.js";
import type { TeacherImpact } from "./impact-groups.js";
const ISO_TIME_START = 11;
const ISO_TIME_END = 16;
export type PreviewEntry = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  name: string;
};
export type CalendarChangePreview = {
  subject: string;
  fingerprint: string;
  from: string;
  through: string;
  sessions: (PreviewEntry & { classId: string })[];
  appointments: PreviewEntry[];
  visits: PreviewEntry[];
  preserved: number;
  plans: { id: string; title: string; date: string; classId: string | null; name: string }[];
  releasedDates: string[];
  capacity: Awaited<ReturnType<typeof calendarCapacity>>;
  teachers: TeacherImpact[];
  confirmationPhrase: string | null;
  periodChange: {
    before: { from: string; through: string };
    after: { from: string; through: string };
  } | null;
};
export function impactFingerprint(
  input: {
    rows: ImpactRows;
    state: CalendarChangeState;
    change: CalendarChange;
    capacity: CalendarChangePreview["capacity"];
    teachers: TeacherImpact[];
  },
  candidates: ImpactCandidates,
): string {
  const { rows, state, change, capacity } = input;
  const { sessions, appointments, visits, plannedItems } = rows;
  const { cancellableSessions, cancellableAppointments, cancellableVisits } = candidates;
  const evidence = {
    capacity,
    teachers: input.teachers,
    change,
    state: {
      periods: state.periods,
      interruptions: state.interruptions,
      closedDays: state.closedDays,
    },
    sessions: sessions.map((row) => [row.id, row.updatedAt, row._count, row.classRecord]),
    appointments: appointments.map((row) => [row.id, row.updatedAt, row.version]),
    visits: visits.map((row) => [row.id, row.updatedAt, row.assessment]),
    plans: plannedItems.map((row) => [row.id, row.updatedAt]),
    eligible: [
      cancellableSessions.map((row) => row.id),
      cancellableAppointments.map((row) => row.id),
      cancellableVisits.map((row) => row.id),
    ],
  };
  return createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
}
export const impactEntry = (
  row: { id: string; date: Date; startTime: Date; endTime: Date },
  name: string,
): PreviewEntry => ({
  id: row.id,
  date: civil(row.date),
  startTime: row.startTime.toISOString().slice(ISO_TIME_START, ISO_TIME_END),
  endTime: row.endTime.toISOString().slice(ISO_TIME_START, ISO_TIME_END),
  name,
});

export function impactSubject(change: CalendarChange, state: CalendarChangeState): string {
  switch (change.action) {
    case "period": {
      return change.name;
    }
    case "interruption": {
      return change.title;
    }
    case "removeInterruption": {
      return state.interruption!.title;
    }
    case "holidays": {
      return `${change.dates.length} feriados selecionados`;
    }
  }
}
