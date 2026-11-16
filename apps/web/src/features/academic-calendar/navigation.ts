"use client";

import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { schoolToday } from "~/features/class-records/calendar-model";

const DATE_LENGTH = 10;
const YEAR_LENGTH = 4;
const MONTH_START = 5;
const MONTH_END = 7;
const MONTHS_PER_YEAR = 12;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

export type AcademicCalendarLocation = {
  month: number | null;
  date: string | null;
  daily: boolean;
};

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, DATE_LENGTH) === value;
}

export function useAcademicCalendarNavigation(): AcademicCalendarNavigation {
  const [query, setQuery] = useQueryStates(
    {
      ano: parseAsInteger.withDefault(Number(schoolToday().slice(0, YEAR_LENGTH))),
      mes: parseAsInteger,
      data: parseAsString,
      agenda: parseAsBoolean.withDefault(false),
      periodo: parseAsString,
    },
    { history: "push" },
  );
  const year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, query.ano));
  const date =
    validDate(query.data) && (query.periodo || Number(query.data.slice(0, YEAR_LENGTH)) === year)
      ? query.data
      : null;
  const month = selectedMonth({ month: query.mes, date, daily: query.agenda });
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
        ano: Math.min(MAX_YEAR, Math.max(MIN_YEAR, next)),
        mes: null,
        data: null,
        agenda: null,
        periodo: null,
      });
    },
    setMonth: (nextYear: number, nextMonth: number) => {
      const value = new Date(Date.UTC(nextYear, nextMonth, 1));
      if (value.getUTCFullYear() < MIN_YEAR || value.getUTCFullYear() > MAX_YEAR) return;
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
            ? Number(location.date.slice(0, YEAR_LENGTH))
            : year,
        mes: location.month === null ? null : location.month + 1,
        data: location.date,
        agenda: location.daily || null,
      });
    },
  };
}

export type AcademicCalendarNavigation = {
  year: number;
  periodId: string | null;
  location: AcademicCalendarLocation;
  setPeriod: (period: { id: string; startDate: Date }, preserveView?: boolean) => void;
  setYear: (year: number) => void;
  setMonth: (year: number, month: number) => void;
  setLocation: (location: AcademicCalendarLocation) => void;
};
function selectedMonth({ month, date, daily }: AcademicCalendarLocation): number | null {
  if (month !== null && month >= 1 && month <= MONTHS_PER_YEAR) return month - 1;
  return date && daily ? Number(date.slice(MONTH_START, MONTH_END)) - 1 : null;
}
