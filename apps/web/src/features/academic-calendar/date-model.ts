import type { AcademicYear } from "./model";

const DATE_LENGTH = 10;

export const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const civilDate = (value: Date): string => value.toISOString().slice(0, DATE_LENGTH);
export const dayDate = (value: string): Date => new Date(`${value}T12:00:00Z`);
export const isoDay = ({
  year,
  month,
  day,
}: {
  year: number;
  month: number;
  day: number;
}): string => civilDate(new Date(Date.UTC(year, month, day)));
export const shiftDay = (value: string, amount: number): string => {
  const date = dayDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return civilDate(date);
};
export const shortDate = (value: string, includeYear = false): string =>
  dayDate(value).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    ...(includeYear ? { year: "numeric" as const } : {}),
  });
export const fullDate = (value: string): string =>
  dayDate(value).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
export const schoolDate = (value: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
export const schoolTime = (value: Date): string =>
  value.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });

export type CalendarEntry = {
  key: string;
  id: string;
  kind: "boundary" | "holiday" | "event";
  title: string;
  from: string;
  through: string;
  detail: string;
  description?: string | null;
  editor: "period" | "interruption" | "event" | null;
};

/** A single, chronological list for month annotations and the contextual day panel. */
export function calendarEntries(data: AcademicYear): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  for (const period of data.periods) {
    for (const [edge, date] of [
      ["Início", period.startDate],
      ["Fim", period.endDate],
    ] as const) {
      entries.push({
        key: `${period.id}-${edge}`,
        id: period.id,
        kind: "boundary",
        title: `${edge} · ${period.name}`,
        from: civilDate(date),
        through: civilDate(date),
        detail: "Limite para as aulas regulares",
        editor: "period",
      });
    }
  }
  for (const row of data.interruptions) {
    entries.push({
      key: row.id,
      id: row.id,
      kind: "holiday",
      title: row.title,
      from: civilDate(row.fromDate),
      through: civilDate(row.throughDate),
      detail: "Sem atividades acadêmicas",
      description: row.description,
      editor: "interruption",
    });
  }
  for (const row of data.closedDays) {
    const date = civilDate(row.date);
    if (
      entries.some(
        (entry) => entry.kind === "holiday" && entry.from <= date && entry.through >= date,
      )
    )
      continue;
    entries.push({
      key: row.id,
      id: row.id,
      kind: "holiday",
      title: row.reason,
      from: date,
      through: date,
      detail: "Sem atividades acadêmicas",
      editor: null,
    });
  }
  for (const event of data.events) {
    entries.push({
      key: event.id,
      id: event.id,
      kind: "event",
      title: event.title,
      from: schoolDate(event.startsAt),
      // Events ending at midnight do not occupy the next civil date.
      through: schoolDate(new Date(event.endsAt.getTime() - 1)),
      detail: `${schoolTime(event.startsAt)}–${schoolTime(event.endsAt)} · não suspende aulas`,
      description: event.description,
      editor: "event",
    });
  }
  return entries.toSorted(
    (left, right) => left.from.localeCompare(right.from) || left.title.localeCompare(right.title),
  );
}

export const entriesInRange = (
  entries: CalendarEntry[],
  { from, through }: { from: string; through: string },
): CalendarEntry[] => entries.filter((entry) => entry.from <= through && entry.through >= from);
