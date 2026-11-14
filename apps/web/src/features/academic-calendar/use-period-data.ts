"use client";

import { useEffect, useMemo } from "react";
import { trpc, type QueryResult } from "~/lib/trpc";
import { schoolToday } from "~/features/class-records/calendar-model";
import { mergeCalendarYears, periodCalendarMonths, selectedCalendarPeriod } from "./period-model";
import type { AcademicYear } from "./model";
import type { CalendarPeriod } from "./period-model";
import type { useAcademicCalendarNavigation } from "./navigation";

export function useCalendarPeriodData(
  navigation: ReturnType<typeof useAcademicCalendarNavigation>,
): CalendarPeriodData {
  const primary = useCalendarYear({ year: navigation.year });
  const periods = primary.data?.periods ?? [];
  const period = selectedCalendarPeriod(periods, {
    selectedId: navigation.periodId,
    year: navigation.year,
    today: schoolToday(),
  });
  useEffect(() => {
    if (
      period &&
      (navigation.periodId !== period.id ||
        (navigation.location.month === null &&
          navigation.year !== period.startDate.getUTCFullYear()))
    ) {
      navigation.setPeriod(period, true);
    }
  }, [period, navigation]);
  const { firstYear, lastYear, needsSecondYear, needsPreviousYear } = periodQueryYears({
    period,
    periods,
    navigation,
  });
  const secondary = useCalendarYear({
    year: Math.min(MAX_YEAR, lastYear),
    enabled: needsSecondYear,
  });
  const previous = useCalendarYear({
    year: Math.max(MIN_YEAR, firstYear),
    enabled: needsPreviousYear,
  });
  const data = useMemo(() => {
    if (
      !primary.data ||
      (needsSecondYear && !secondary.data) ||
      (needsPreviousYear && !previous.data)
    )
      return;
    return mergeCalendarYears(
      mergeCalendarYears(primary.data, needsSecondYear ? secondary.data : undefined),
      needsPreviousYear ? previous.data : undefined,
    );
  }, [primary.data, needsSecondYear, secondary.data, needsPreviousYear, previous.data]);
  return periodDataResult({
    data,
    periods,
    period,
    primary,
    secondary,
    previous,
    needsSecondYear,
    needsPreviousYear,
  });
}

function periodDataResult({
  data,
  periods,
  period,
  primary,
  secondary,
  previous,
  needsSecondYear,
  needsPreviousYear,
}: {
  data: AcademicYear | undefined;
  periods: CalendarPeriod[];
  period: CalendarPeriod | null;
  primary: QueryResult<AcademicYear>;
  secondary: QueryResult<AcademicYear>;
  previous: QueryResult<AcademicYear>;
  needsSecondYear: boolean;
  needsPreviousYear: boolean;
}): CalendarPeriodData {
  return {
    data,
    periods,
    period,
    error:
      primary.error ??
      (needsSecondYear ? secondary.error : null) ??
      (needsPreviousYear ? previous.error : null),
    isFetching:
      primary.isFetching ||
      (needsSecondYear && secondary.isFetching) ||
      (needsPreviousYear && previous.isFetching),
    refetch: () =>
      Promise.all([
        primary.refetch(),
        ...(needsSecondYear ? [secondary.refetch()] : []),
        ...(needsPreviousYear ? [previous.refetch()] : []),
      ]),
  };
}

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const STALE_TIME = 30_000;
const REQUEST_POLL_INTERVAL = 3000;
type CalendarPeriodData = {
  data: AcademicYear | undefined;
  periods: CalendarPeriod[];
  period: CalendarPeriod | null;
  error: QueryResult<AcademicYear>["error"];
  isFetching: boolean;
  refetch: () => Promise<Awaited<ReturnType<QueryResult<AcademicYear>["refetch"]>>[]>;
};
function useCalendarYear({
  year,
  enabled = true,
}: {
  year: number;
  enabled?: boolean;
}): QueryResult<AcademicYear> {
  return trpc.calendar.academic.year.useQuery(
    { year },
    {
      enabled,
      staleTime: STALE_TIME,
      refetchInterval: (query) =>
        enabled &&
        query.state.data?.requests.some(
          (row) => row.status === "PENDING" || row.status === "RUNNING",
        )
          ? REQUEST_POLL_INTERVAL
          : false,
    },
  );
}

function periodQueryYears({
  period,
  periods,
  navigation,
}: {
  period: CalendarPeriod | null;
  periods: CalendarPeriod[];
  navigation: ReturnType<typeof useAcademicCalendarNavigation>;
}): { firstYear: number; lastYear: number; needsSecondYear: boolean; needsPreviousYear: boolean } {
  const months = periodCalendarMonths(period, { fallbackYear: navigation.year, periods });
  const firstYear = months[0]?.year ?? navigation.year;
  const lastYear = months.at(-1)?.year ?? navigation.year;
  const needsSecondYear = Boolean(
    period && navigation.location.month === null && lastYear !== navigation.year,
  );
  const needsPreviousYear = Boolean(
    period &&
    navigation.location.month === null &&
    firstYear !== navigation.year &&
    firstYear !== lastYear,
  );
  return { firstYear, lastYear, needsSecondYear, needsPreviousYear };
}
