"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Plus, Settings2 } from "lucide-react";
import { Button } from "@lazuli/ui";
import { schoolToday } from "~/features/class-records/calendar-model";
import { AcademicMonthGrid } from "./month-grid";
import { CalendarContextPanel } from "./context-panel";
import {
  calendarEntries,
  civilDate,
  entriesInRange,
  isoDay,
  MONTHS,
  shortDate,
  type CalendarEntry,
} from "./date-model";
import type { AcademicYear } from "./model";
import type { useAcademicCalendarNavigation } from "./navigation";
import { useCalendarMotion } from "./use-calendar-motion";
import { periodCalendarMonths, periodVacations, type CalendarPeriod } from "./period-model";
import styles from "./workspace.module.css";

export function AcademicCalendarWorkspace({
  data,
  navigation,
  period,
  periods,
  refreshing,
  notice,
  editor,
  dailyAgenda,
  onCreate,
  onEdit,
  onConfigure,
  onInterruption,
  disabled = false,
  unavailable = false,
}: {
  data: AcademicYear | undefined;
  navigation: ReturnType<typeof useAcademicCalendarNavigation>;
  period: CalendarPeriod | null;
  periods: CalendarPeriod[];
  refreshing: boolean;
  notice?: ReactNode;
  editor?: ReactNode;
  dailyAgenda?: ReactNode;
  onCreate: (date: string) => void;
  onEdit: (entry: CalendarEntry) => void;
  onConfigure: () => void;
  onInterruption: (date: string) => void;
  disabled?: boolean;
  unavailable?: boolean;
}) {
  const { year, location, setLocation } = navigation;
  const { month, date, daily } = location;
  const today = schoolToday();
  const periodIndex = periods.findIndex((row) => row.id === period?.id);
  const previousPeriod = periods[periodIndex - 1];
  const nextPeriod = periods[periodIndex + 1];
  const months = useMemo(
    () => periodCalendarMonths(period, year, periods),
    [period, year, periods],
  );
  const vacations = useMemo(() => periodVacations(period, periods), [period, periods]);
  const entries = useMemo(() => (data ? calendarEntries(data) : []), [data]);
  const from = month === null && period ? civilDate(period.startDate) : isoDay(year, month ?? 0, 1);
  const through =
    month === null && period
      ? civilDate(period.endDate)
      : isoDay(year, month === null ? 12 : month + 1, 0);
  const scopedEntries = useMemo(
    () => entriesInRange(entries, from, through),
    [entries, from, through],
  );
  const canvasRef = useCalendarMotion(
    year * 372 +
      (month ?? period?.startDate.getUTCMonth() ?? 0) * 31 +
      (daily && date ? Number(date.slice(-2)) : 0),
    `${period?.id ?? "empty"}:${daily ? "day" : month === null ? "period" : "month"}`,
  );
  const contextRef = useCalendarMotion(
    date ? Number(date.replaceAll("-", "")) : 0,
    editor ? "editor" : "context",
  );
  const annualScroll = useRef(0);
  const previousView = useRef({ year, month, daily, periodId: period?.id });
  useLayoutEffect(() => {
    const previous = previousView.current;
    previousView.current = { year, month, daily, periodId: period?.id };
    if (
      previous.year === year &&
      previous.month === month &&
      previous.daily === daily &&
      previous.periodId === period?.id
    )
      return;
    const main = canvasRef.current?.closest("main");
    if (main)
      main.scrollTop =
        month === null && previous.periodId === period?.id ? annualScroll.current : 0;
    if (previous.periodId !== period?.id) annualScroll.current = 0;
  }, [year, month, daily, period, canvasRef]);
  useEffect(() => {
    if (month !== null) return;
    const main = canvasRef.current?.closest("main");
    if (!main) return;
    const remember = () => {
      annualScroll.current = main.scrollTop;
    };
    main.addEventListener("scroll", remember, { passive: true });
    return () => main.removeEventListener("scroll", remember);
  }, [year, month, canvasRef]);
  const suggestedDate = date ?? (today >= from && today <= through ? today : from);
  function revealContext() {
    if (matchMedia("(max-width: 900px)").matches) {
      requestAnimationFrame(() =>
        contextRef.current?.scrollIntoView({
          block: "start",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        }),
      );
    }
  }
  function selectDay(value: string) {
    if (disabled) return;
    setLocation({
      month: month === null ? null : Number(value.slice(5, 7)) - 1,
      date: value,
      daily: false,
    });
    revealContext();
  }
  function closeContext() {
    const selected = canvasRef.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`);
    setLocation({ month, date: null, daily: false });
    requestAnimationFrame(() => {
      selected?.focus({ preventScroll: true });
      selected?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
  }
  function create() {
    onCreate(suggestedDate);
    revealContext();
  }
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.title}>
          <h1>Calendário acadêmico</h1>
          <p className={styles.subtitle}>Semestres, pausas e eventos que organizam as aulas.</p>
        </div>
        {!daily && (
          <div className={styles.navigation}>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={month === null ? "Período anterior" : "Mês anterior"}
              title={month === null ? previousPeriod?.name : undefined}
              disabled={
                disabled || (month === null ? !previousPeriod : year === 2000 && month === 0)
              }
              onClick={() =>
                month === null
                  ? previousPeriod && navigation.setPeriod(previousPeriod)
                  : navigation.setMonth(year, month - 1)
              }
            >
              <ChevronLeft />
            </Button>
            <div className={styles.navigationLabel}>
              <h2 data-month={month !== null} aria-live="polite" title={period?.name}>
                {month === null
                  ? (period?.name ??
                    (unavailable ? "Indisponível" : data ? "Sem períodos" : "Carregando…"))
                  : `${MONTHS[month]} ${year}`}
              </h2>
              {month === null && period && (
                <p>
                  {shortDate(civilDate(period.startDate))} — {shortDate(civilDate(period.endDate))}
                </p>
              )}
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={month === null ? "Próximo período" : "Próximo mês"}
              title={month === null ? nextPeriod?.name : undefined}
              disabled={disabled || (month === null ? !nextPeriod : year === 2100 && month === 11)}
              onClick={() =>
                month === null
                  ? nextPeriod && navigation.setPeriod(nextPeriod)
                  : navigation.setMonth(year, month + 1)
              }
            >
              <ChevronRight />
            </Button>
          </div>
        )}
        <div className={styles.actions}>
          {!daily && (
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() =>
                setLocation({ month: Number(today.slice(5, 7)) - 1, date: today, daily: false })
              }
            >
              Hoje
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={!data || disabled} onClick={onConfigure}>
            <Settings2 aria-hidden="true" /> Configurar
          </Button>
          <Button size="sm" disabled={!data || disabled || Boolean(editor)} onClick={create}>
            <Plus aria-hidden="true" /> Novo evento
          </Button>
        </div>
        <span className={styles.status} role="status">
          {unavailable
            ? "Datas indisponíveis"
            : !data
              ? `Carregando ${year}…`
              : refreshing
                ? "Atualizando calendário…"
                : ""}
        </span>
      </header>
      {notice}
      <div className={styles.layout} data-daily={daily}>
        <div ref={canvasRef} className={styles.canvas} aria-busy={!data && !unavailable}>
          {dailyAgenda ??
            (month === null ? (
              <div
                className={styles.months}
                aria-label={period ? `Calendário de ${period.name}` : "Calendário acadêmico"}
              >
                {months.map((value) => (
                  <AcademicMonthGrid
                    key={value.from}
                    year={value.year}
                    month={value.month}
                    data={data}
                    entries={entries}
                    today={today}
                    selected={date}
                    compact
                    period={period}
                    vacations={vacations}
                    showYear={months[0]?.year !== months.at(-1)?.year}
                    disabled={disabled}
                    unavailable={unavailable}
                    onOpenMonth={() => !disabled && navigation.setMonth(value.year, value.month)}
                    onSelectDay={selectDay}
                  />
                ))}
              </div>
            ) : (
              <>
                <AcademicMonthGrid
                  year={year}
                  month={month}
                  data={data}
                  entries={scopedEntries}
                  period={period}
                  vacations={vacations}
                  today={today}
                  selected={date}
                  disabled={disabled}
                  unavailable={unavailable}
                  onSelectDay={selectDay}
                />
                <div className={styles.monthNotes}>
                  <span>Selecione um dia para consultar ou adicionar eventos.</span>
                  <span>Horários de São Paulo</span>
                </div>
              </>
            ))}
        </div>
        <div ref={contextRef} className={styles.contextSlot}>
          {editor ? (
            <aside className={styles.context} data-editing="true">
              {editor}
            </aside>
          ) : (
            <CalendarContextPanel
              data={data}
              unavailable={unavailable}
              daily={daily}
              period={period}
              vacations={vacations}
              entries={date ? entries : scopedEntries}
              year={year}
              month={month}
              date={date}
              today={today}
              onSelectDate={selectDay}
              onEdit={onEdit}
              onCreate={create}
              onInterruption={() => onInterruption(suggestedDate)}
              onConfigure={onConfigure}
              onClear={closeContext}
              onDayAgenda={() =>
                setLocation({
                  month: Number(suggestedDate.slice(5, 7)) - 1,
                  date: suggestedDate,
                  daily: true,
                })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
