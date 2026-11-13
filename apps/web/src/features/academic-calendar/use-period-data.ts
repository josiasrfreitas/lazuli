"use client";

import { useEffect, useMemo } from "react";
import { trpc } from "~/lib/trpc";
import { schoolToday } from "~/features/class-records/calendar-model";
import { mergeCalendarYears, periodCalendarMonths, selectedCalendarPeriod } from "./period-model";
import type { useAcademicCalendarNavigation } from "./navigation";

export function useCalendarPeriodData(
  navigation: ReturnType<typeof useAcademicCalendarNavigation>,
) {
  const primary = trpc.calendar.academic.year.useQuery(
    { year: navigation.year },
    {
      staleTime: 30000,
      refetchInterval: (query) =>
        query.state.data?.requests.some(
          (row) => row.status === "PENDING" || row.status === "RUNNING",
        )
          ? 3000
          : false,
    },
  );
  const periods = primary.data?.periods ?? [];
  const period = selectedCalendarPeriod(
    periods,
    navigation.periodId,
    navigation.year,
    schoolToday(),
  );
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
  const months = periodCalendarMonths(period, navigation.year, periods);
  const firstYear = months[0]?.year ?? navigation.year;
  const lastYear = months.at(-1)?.year ?? navigation.year;
  const needsSecondYear = Boolean(
    period && navigation.location.month === null && lastYear !== navigation.year,
  );
  const secondary = trpc.calendar.academic.year.useQuery(
    { year: Math.min(2100, lastYear) },
    {
      enabled: needsSecondYear,
      staleTime: 30000,
      refetchInterval: (query) =>
        needsSecondYear &&
        query.state.data?.requests.some(
          (row) => row.status === "PENDING" || row.status === "RUNNING",
        )
          ? 3000
          : false,
    },
  );
  const needsPreviousYear = Boolean(
    period &&
    navigation.location.month === null &&
    firstYear !== navigation.year &&
    firstYear !== lastYear,
  );
  const previous = trpc.calendar.academic.year.useQuery(
    { year: Math.max(2000, firstYear) },
    {
      enabled: needsPreviousYear,
      staleTime: 30000,
      refetchInterval: (query) =>
        needsPreviousYear &&
        query.state.data?.requests.some(
          (row) => row.status === "PENDING" || row.status === "RUNNING",
        )
          ? 3000
          : false,
    },
  );
  const data = useMemo(() => {
    if (
      !primary.data ||
      (needsSecondYear && !secondary.data) ||
      (needsPreviousYear && !previous.data)
    )
      return undefined;
    return mergeCalendarYears(
      mergeCalendarYears(primary.data, needsSecondYear ? secondary.data : undefined),
      needsPreviousYear ? previous.data : undefined,
    );
  }, [primary.data, needsSecondYear, secondary.data, needsPreviousYear, previous.data]);
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
