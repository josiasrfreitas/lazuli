"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
  type ReactElement,
} from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { CalendarActions } from "./actions";
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
import {
  periodCalendarMonths,
  periodVacations,
  type CalendarPeriod,
  type CalendarVacations,
} from "./period-model";
import styles from "./workspace.module.css";

type WorkspaceProps = {
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
  onConfigure: (section?: string) => void;
  onInterruption: (date: string) => void;
  disabled?: boolean;
  unavailable?: boolean;
};
type ResolvedProps = WorkspaceProps & { disabled: boolean; unavailable: boolean };
const MONTHS_PER_YEAR = 12;
const YEAR_MOTION_STRIDE = 372;
const MONTH_MOTION_STRIDE = 31;
const DAY_SUFFIX = -2;
const MONTH_START = 5;
const MONTH_END = 7;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const LAST_MONTH = 11;
type WorkspaceModel = {
  year: number;
  month: number | null;
  date: string | null;
  daily: boolean;
  today: string;
  previousPeriod: CalendarPeriod | undefined;
  nextPeriod: CalendarPeriod | undefined;
  months: ReturnType<typeof periodCalendarMonths>;
  vacations: CalendarVacations;
  entries: CalendarEntry[];
  scopedEntries: CalendarEntry[];
  from: string;
  through: string;
  suggestedDate: string;
};
type WorkspaceMotion = {
  canvasRef: ReturnType<typeof useCalendarMotion>;
  contextRef: ReturnType<typeof useCalendarMotion>;
};
type WorkspaceActions = {
  selectDay: (value: string) => void;
  closeContext: () => void;
  create: () => void;
};
type WorkspaceController = WorkspaceMotion & WorkspaceActions & { model: WorkspaceModel };
type ViewProps = { props: ResolvedProps; controller: WorkspaceController };
export function AcademicCalendarWorkspace({
  disabled = false,
  unavailable = false,
  ...rest
}: WorkspaceProps): ReactElement {
  const props = { ...rest, disabled, unavailable };
  const model = useWorkspaceModel(props);
  const motion = useWorkspaceMotion(props, model);
  useCalendarScroll({ ...motion, model, period: props.period });
  const controller = { model, ...motion, ...workspaceActions({ props, model, ...motion }) };
  return <WorkspaceLayout props={props} controller={controller} />;
}
function useWorkspaceModel({ navigation, period, periods, data }: WorkspaceProps): WorkspaceModel {
  const { year, location } = navigation;
  const { month, date, daily } = location;
  const today = schoolToday();
  const periodIndex = periods.findIndex((row) => row.id === period?.id);
  const previousPeriod = periods[periodIndex - 1];
  const nextPeriod = periods[periodIndex + 1];
  const months = useMemo(
    () => periodCalendarMonths(period, { fallbackYear: year, periods }),
    [period, year, periods],
  );
  const vacations = useMemo(() => periodVacations(period, periods), [period, periods]);
  const entries = useMemo(() => (data ? calendarEntries(data) : []), [data]);
  const from =
    month === null && period
      ? civilDate(period.startDate)
      : isoDay({ year, month: month ?? 0, day: 1 });
  const through =
    month === null && period
      ? civilDate(period.endDate)
      : isoDay({ year, month: month === null ? MONTHS_PER_YEAR : month + 1, day: 0 });
  const scopedEntries = useMemo(
    () => entriesInRange(entries, { from, through }),
    [entries, from, through],
  );
  const suggestedDate = date ?? (today >= from && today <= through ? today : from);
  return {
    year,
    month,
    date,
    daily,
    today,
    previousPeriod,
    nextPeriod,
    months,
    vacations,
    entries,
    scopedEntries,
    from,
    through,
    suggestedDate,
  };
}
function useWorkspaceMotion(
  { period, editor }: WorkspaceProps,
  { year, month, daily, date }: WorkspaceModel,
): WorkspaceMotion {
  const canvasRef = useCalendarMotion(
    year * YEAR_MOTION_STRIDE +
      (month ?? period?.startDate.getUTCMonth() ?? 0) * MONTH_MOTION_STRIDE +
      (daily && date ? Number(date.slice(DAY_SUFFIX)) : 0),
    `${period?.id ?? "empty"}:${calendarViewKind({ daily, month })}`,
  );
  const contextRef = useCalendarMotion(
    date ? Number(date.replaceAll("-", "")) : 0,
    editor ? "editor" : "context",
  );
  return { canvasRef, contextRef };
}
function useCalendarScroll({
  canvasRef,
  model: { year, month, daily },
  period,
}: WorkspaceMotion & { model: WorkspaceModel; period: CalendarPeriod | null }): void {
  const periodId = period?.id;
  const annualScroll = useRef(0);
  const previousView = useRef({ year, month, daily, periodId });
  useLayoutEffect(() => {
    const previous = previousView.current;
    previousView.current = { year, month, daily, periodId };
    if (sameCalendarView(previous, { year, month, daily, periodId })) return;
    const main = canvasRef.current?.closest("main");
    if (main)
      main.scrollTop = month === null && previous.periodId === periodId ? annualScroll.current : 0;
    if (previous.periodId !== periodId) annualScroll.current = 0;
  }, [year, month, daily, period, periodId, canvasRef]);
  useEffect(() => {
    if (month !== null) return;
    const main = canvasRef.current?.closest("main");
    if (!main) return;
    const remember = (): void => {
      annualScroll.current = main.scrollTop;
    };
    main.addEventListener("scroll", remember, { passive: true });
    return () => main.removeEventListener("scroll", remember);
  }, [year, month, canvasRef]);
}
function workspaceActions({
  props: {
    navigation: { setLocation },
    disabled,
    onCreate,
  },
  model: { date, month, suggestedDate },
  canvasRef,
  contextRef,
}: WorkspaceMotion & { props: ResolvedProps; model: WorkspaceModel }): WorkspaceActions {
  function revealContext(): void {
    if (matchMedia("(max-width: 900px)").matches) {
      requestAnimationFrame(() =>
        contextRef.current?.scrollIntoView({
          block: "start",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        }),
      );
    }
  }
  function selectDay(value: string): void {
    if (disabled) return;
    setLocation({
      month: month === null ? null : Number(value.slice(MONTH_START, MONTH_END)) - 1,
      date: value,
      daily: false,
    });
    revealContext();
  }
  function closeContext(): void {
    const selected = canvasRef.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`);
    setLocation({ month, date: null, daily: false });
    requestAnimationFrame(() => {
      selected?.focus({ preventScroll: true });
      selected?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
  }
  function create(): void {
    onCreate(suggestedDate);
    revealContext();
  }
  return { selectDay, closeContext, create };
}
function WorkspaceLayout({ props, controller }: ViewProps): ReactElement {
  const { data, unavailable, notice, dailyAgenda } = props;
  const {
    canvasRef,
    contextRef,
    model: { daily },
  } = controller;
  return (
    <div className={styles.page}>
      <WorkspaceHeader props={props} controller={controller} />
      {notice}
      <div className={styles.layout} data-daily={daily}>
        <div ref={canvasRef} className={styles.canvas} aria-busy={!data && !unavailable}>
          {dailyAgenda ?? <WorkspaceMonths props={props} controller={controller} />}
        </div>
        <div ref={contextRef} className={styles.contextSlot}>
          <WorkspaceContext props={props} controller={controller} />
        </div>
      </div>
    </div>
  );
}
function WorkspaceHeader({ props, controller }: ViewProps): ReactElement {
  const {
    model: { daily },
  } = controller;
  return (
    <header className={styles.header}>
      <div className={styles.title}>
        <h1>Calendário acadêmico</h1>
        <p className={styles.subtitle}>Semestres, pausas e eventos que organizam as aulas.</p>
      </div>
      {!daily && <WorkspaceNavigation props={props} controller={controller} />}
      <WorkspaceButtons props={props} controller={controller} />
      <span className={styles.status} role="status">
        {workspaceStatus(props)}
      </span>
    </header>
  );
}
function WorkspaceNavigation({ props, controller }: ViewProps): ReactElement {
  const { period, unavailable, data } = props;
  const {
    model: { month, year },
  } = controller;
  return (
    <div className={styles.navigation}>
      <PreviousPeriodButton props={props} controller={controller} />
      <div className={styles.navigationLabel}>
        <h2 data-month={month !== null} aria-live="polite" title={period?.name}>
          {navigationLabel({ month, year, period, unavailable, data })}
        </h2>
        {month === null && period && (
          <p>
            {shortDate(civilDate(period.startDate))} — {shortDate(civilDate(period.endDate))}
          </p>
        )}
      </div>
      <NextPeriodButton props={props} controller={controller} />
    </div>
  );
}
function WorkspaceButtons({ props, controller }: ViewProps): ReactElement {
  const {
    disabled,
    data,
    editor,
    onConfigure,
    navigation: { setLocation },
  } = props;
  const {
    create,
    model: { daily, today },
  } = controller;
  return (
    <div className={styles.actions}>
      {!daily && (
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={() =>
            setLocation({
              month: Number(today.slice(MONTH_START, MONTH_END)) - 1,
              date: today,
              daily: false,
            })
          }
        >
          Hoje
        </Button>
      )}
      <CalendarActions
        year={props.navigation.year}
        disabled={!data || disabled}
        onConfigure={onConfigure}
      />
      <Button size="sm" disabled={!data || disabled || Boolean(editor)} onClick={create}>
        <Plus aria-hidden="true" /> Novo evento
      </Button>
    </div>
  );
}
function WorkspaceMonths({ props, controller }: ViewProps): ReactElement {
  const { period, data, disabled, unavailable, navigation } = props;
  const {
    selectDay,
    model: { month, months, year, entries, scopedEntries, vacations, today, date },
  } = controller;
  return month === null ? (
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
  );
}
function WorkspaceContext({ props, controller }: ViewProps): ReactElement {
  const {
    editor,
    data,
    unavailable,
    period,
    onEdit,
    onInterruption,
    onConfigure,
    navigation: { setLocation },
  } = props;
  const {
    create,
    selectDay,
    closeContext,
    model: { daily, vacations, date, entries, scopedEntries, year, month, today, suggestedDate },
  } = controller;
  return editor ? (
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
          month: Number(suggestedDate.slice(MONTH_START, MONTH_END)) - 1,
          date: suggestedDate,
          daily: true,
        })
      }
    />
  );
}
function workspaceStatus({ unavailable, data, refreshing, navigation }: WorkspaceProps): string {
  if (unavailable) return "Datas indisponíveis";
  if (!data) return `Carregando ${navigation.year}…`;
  return refreshing ? "Atualizando calendário…" : "";
}

function calendarViewKind({ daily, month }: Pick<WorkspaceModel, "daily" | "month">): string {
  if (daily) return "day";
  return month === null ? "period" : "month";
}

function navigationLabel({
  month,
  year,
  period,
  unavailable,
  data,
}: Pick<WorkspaceModel, "month" | "year"> &
  Pick<WorkspaceProps, "period" | "unavailable" | "data">): string {
  if (month !== null) return `${MONTHS[month]} ${year}`;
  if (period) return period.name;
  if (unavailable) return "Indisponível";
  return data ? "Sem períodos" : "Carregando…";
}

type ScrollView = Pick<WorkspaceModel, "year" | "month" | "daily"> & {
  periodId: string | undefined;
};
function sameCalendarView(previous: ScrollView, current: ScrollView): boolean {
  return (
    previous.year === current.year &&
    previous.month === current.month &&
    previous.daily === current.daily &&
    previous.periodId === current.periodId
  );
}

function PreviousPeriodButton({ props, controller }: ViewProps): ReactElement {
  const { disabled, navigation } = props;
  const {
    model: { month, year, previousPeriod },
  } = controller;
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={month === null ? "Período anterior" : "Mês anterior"}
      title={month === null ? previousPeriod?.name : undefined}
      disabled={disabled || (month === null ? !previousPeriod : year === MIN_YEAR && month === 0)}
      onClick={() =>
        month === null
          ? previousPeriod && navigation.setPeriod(previousPeriod)
          : navigation.setMonth(year, month - 1)
      }
    >
      <ChevronLeft />
    </Button>
  );
}

function NextPeriodButton({ props, controller }: ViewProps): ReactElement {
  const { disabled, navigation } = props;
  const {
    model: { month, year, nextPeriod },
  } = controller;
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={month === null ? "Próximo período" : "Próximo mês"}
      title={month === null ? nextPeriod?.name : undefined}
      disabled={
        disabled || (month === null ? !nextPeriod : year === MAX_YEAR && month === LAST_MONTH)
      }
      onClick={() =>
        month === null
          ? nextPeriod && navigation.setPeriod(nextPeriod)
          : navigation.setMonth(year, month + 1)
      }
    >
      <ChevronRight />
    </Button>
  );
}
