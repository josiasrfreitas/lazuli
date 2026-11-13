"use client";

import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { schoolToday } from "~/features/class-records/calendar-model";

export type AcademicCalendarLocation = {
  month: number | null;
  date: string | null;
  daily: boolean;
};

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function useAcademicCalendarNavigation() {
  const [query, setQuery] = useQueryStates(
    {
      ano: parseAsInteger.withDefault(Number(schoolToday().slice(0, 4))),
      mes: parseAsInteger,
      data: parseAsString,
      agenda: parseAsBoolean.withDefault(false),
      periodo: parseAsString,
    },
    { history: "push" },
  );
  const year = Math.min(2100, Math.max(2000, query.ano));
  const date =
    validDate(query.data) && (query.periodo || Number(query.data.slice(0, 4)) === year)
      ? query.data
      : null;
  const month =
    query.mes !== null && query.mes >= 1 && query.mes <= 12
      ? query.mes - 1
      : date && query.agenda
        ? Number(date.slice(5, 7)) - 1
        : null;
  return {
    year,
    periodId: query.periodo,
    location: { month, date, daily: Boolean(date && query.agenda) },
    setPeriod: (period: { id: string; startDate: Date }, preserveView = false) => {
      void setQuery(
        {
          periodo: period.id,
          ano: preserveView && month !== null ? year : period.startDate.getUTCFullYear(),
          ...(preserveView ? {} : { mes: null, data: null, agenda: null }),
        },
        preserveView ? { history: "replace" } : undefined,
      );
    },
    setYear: (next: number) => {
      void setQuery({
        ano: Math.min(2100, Math.max(2000, next)),
        mes: null,
        data: null,
        agenda: null,
        periodo: null,
      });
    },
    setMonth: (nextYear: number, nextMonth: number) => {
      const value = new Date(Date.UTC(nextYear, nextMonth, 1));
      if (value.getUTCFullYear() < 2000 || value.getUTCFullYear() > 2100) return;
      void setQuery({
        ano: value.getUTCFullYear(),
        mes: value.getUTCMonth() + 1,
        data: null,
        agenda: null,
      });
    },
    setLocation: (location: AcademicCalendarLocation) => {
      void setQuery({
        ano:
          location.date && (location.month !== null || !query.periodo)
            ? Number(location.date.slice(0, 4))
            : year,
        mes: location.month === null ? null : location.month + 1,
        data: location.date,
        agenda: location.daily || null,
      });
    },
  };
}
