"use client";

import { trpc, type QueryResult } from "~/lib/trpc";
import { calendarPeriodsInYear } from "./period-model";
import type { AcademicYear } from "./model";
import type { CalendarPeriod } from "./period-model";
import type { useAcademicCalendarNavigation } from "./navigation";

const STALE_TIME = 30_000;
const REQUEST_POLL_INTERVAL = 3000;
type CalendarPeriodData = Pick<
  QueryResult<AcademicYear>,
  "data" | "error" | "isFetching" | "refetch"
> & {
  periods: CalendarPeriod[];
  period: CalendarPeriod | null;
};

export function useCalendarPeriodData(
  navigation: ReturnType<typeof useAcademicCalendarNavigation>,
): CalendarPeriodData {
  const query = trpc.calendar.academic.year.useQuery(
    { year: navigation.year },
    {
      staleTime: STALE_TIME,
      refetchInterval: (current) =>
        current.state.data?.requests.some(
          (row) => row.status === "PENDING" || row.status === "RUNNING",
        )
          ? REQUEST_POLL_INTERVAL
          : false,
    },
  );
  const periods = calendarPeriodsInYear(query.data?.periods ?? [], navigation.year);
  return {
    data: query.data,
    periods,
    period: null,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
