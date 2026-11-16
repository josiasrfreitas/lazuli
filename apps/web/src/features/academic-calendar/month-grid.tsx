"use client";

import { useRef, type KeyboardEvent, type ReactElement, type RefObject } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@lazuli/ui";
import { calendarDay, type AcademicYear, type DayInfo } from "./model";
import {
  MONTHS,
  WEEKDAYS,
  entriesInRange,
  fullDate,
  isoDay,
  type CalendarEntry,
  civilDate,
} from "./date-model";
import { vacationAt, type CalendarPeriod, type CalendarVacations } from "./period-model";
import styles from "./workspace.module.css";

type MonthGridProps = {
  year: number;
  month: number;
  data?: AcademicYear | undefined;
  entries: CalendarEntry[];
  today: string;
  selected: string | null;
  compact?: boolean;
  onOpenMonth?: (() => void) | undefined;
  onSelectDay: (date: string) => void;
  disabled?: boolean;
  unavailable?: boolean;
  period?: CalendarPeriod | null;
  showYear?: boolean;
  vacations?: CalendarVacations;
};
const DAYS_PER_WEEK = 7;
const SATURDAY = 6;
const MONTH_PREFIX_LENGTH = 7;
const TOOLTIP_DELAY = 350;
const VISIBLE_ENTRIES = 2;

export function AcademicMonthGrid({
  year,
  month,
  data,
  entries,
  today,
  selected,
  compact = false,
  onOpenMonth,
  onSelectDay,
  disabled = false,
  unavailable = false,
  period = null,
  showYear = false,
  vacations = { before: null, after: null },
}: MonthGridProps): ReactElement {
  const { offset, count, outsideMonth, monthVacation, monthEntries, focusDay } = monthModel({
    year,
    month,
    period,
    vacations,
    entries,
    selected,
    today,
  });
  const { ref, moveFocus } = useMonthFocus({ year, month, count });
  const context = {
    year,
    month,
    data,
    monthEntries,
    vacations,
    period,
    offset,
    today,
    selected,
    disabled,
    focusDay,
    unavailable,
    compact,
    onSelectDay,
    moveFocus,
  };
  return (
    <MonthContent
      context={context}
      model={{ offset, count, outsideMonth, monthVacation, monthEntries, focusDay }}
      gridRef={ref}
      onOpenMonth={onOpenMonth}
      showYear={showYear}
    />
  );
}

function keyboardDay(key: string, { day, count }: { day: number; count: number }): number | null {
  switch (key) {
    case "ArrowRight": {
      return day + 1;
    }
    case "ArrowLeft": {
      return day - 1;
    }
    case "ArrowDown": {
      return day + DAYS_PER_WEEK;
    }
    case "ArrowUp": {
      return day - DAYS_PER_WEEK;
    }
    case "Home": {
      return 1;
    }
    case "End": {
      return count;
    }
    default: {
      return null;
    }
  }
}
type MonthModelInput = Pick<MonthGridProps, "year" | "month" | "entries" | "selected" | "today"> & {
  period: CalendarPeriod | null;
  vacations: CalendarVacations;
};
type MonthModel = {
  offset: number;
  count: number;
  outsideMonth: boolean;
  monthVacation: ReturnType<typeof vacationAt>;
  monthEntries: CalendarEntry[];
  focusDay: string;
};
function monthModel({
  year,
  month,
  period,
  vacations,
  entries,
  selected,
  today,
}: MonthModelInput): MonthModel {
  const offset = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const outsideMonth = Boolean(
    period &&
    (isoDay({ year, month, day: count }) < civilDate(period.startDate) ||
      isoDay({ year, month, day: 1 }) > civilDate(period.endDate)),
  );
  const firstVacation = vacationAt(isoDay({ year, month, day: 1 }), vacations);
  const monthVacation =
    firstVacation === vacationAt(isoDay({ year, month, day: count }), vacations)
      ? firstVacation
      : null;
  const monthEntries = entriesInRange(entries, {
    from: isoDay({ year, month, day: 1 }),
    through: isoDay({ year, month, day: count }),
  });
  const focusDay = monthFocusDay({ selected, today, first: isoDay({ year, month, day: 1 }) });
  return { offset, count, outsideMonth, monthVacation, monthEntries, focusDay };
}
function MonthHeading({
  compact,
  disabled,
  onOpenMonth,
  month,
  year,
  showYear,
}: Pick<
  MonthGridProps,
  "compact" | "disabled" | "onOpenMonth" | "month" | "year" | "showYear"
>): ReactElement {
  return (
    <>
      {" "}
      {compact && (
        <button
          type="button"
          className={styles.monthHeading}
          disabled={disabled}
          onClick={onOpenMonth}
          aria-label={`Abrir ${MONTHS[month]} de ${year}`}
        >
          <h3>
            {MONTHS[month]}
            {showYear && <small> {year}</small>}
          </h3>
          <ArrowUpRight aria-hidden="true" />
        </button>
      )}
      <div className={styles.weekdays} aria-hidden="true">
        {WEEKDAYS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </>
  );
}
type DayContext = Pick<
  MonthGridProps,
  "year" | "month" | "data" | "today" | "selected" | "onSelectDay"
> & {
  monthEntries: CalendarEntry[];
  vacations: CalendarVacations;
  period: CalendarPeriod | null;
  offset: number;
  disabled: boolean;
  focusDay: string;
  unavailable: boolean;
  compact: boolean;
  moveFocus: (event: KeyboardEvent<HTMLButtonElement>, day: number) => void;
};
function MonthDay({ index, context }: { index: number; context: DayContext }): ReactElement {
  const {
    year,
    month,
    data,
    monthEntries,
    vacations,
    period,
    offset,
    today,
    selected,
    disabled,
    focusDay,
    unavailable,
    compact,
    onSelectDay,
    moveFocus,
  } = context;
  const date = isoDay({ year, month, day: index + 1 });
  const info = data ? calendarDay(date, data) : null;
  const items = entriesInRange(monthEntries, { from: date, through: date });
  const vacation = vacationAt(date, vacations);
  const vacationLabel = vacation === "before" ? "Férias anteriores" : "Férias após o período";
  const kind = dayKind(info, vacation);
  const outside = isOutsidePeriod(date, period);
  return (
    <Tooltip key={date}>
      <TooltipTrigger
        render={<button type="button" className={styles.day} />}
        data-date={date}
        data-kind={kind}
        data-outside={outside}
        data-vacation={vacation ?? undefined}
        data-weekend={
          (offset + index) % DAYS_PER_WEEK === 0 || (offset + index) % DAYS_PER_WEEK === SATURDAY
        }
        data-today={date === today}
        aria-current={date === today ? "date" : undefined}
        aria-pressed={selected === date}
        disabled={!data || disabled}
        tabIndex={date === focusDay ? 0 : -1}
        aria-label={dayAriaLabel({
          date,
          year,
          info,
          vacation,
          vacationLabel,
          unavailable,
          outside,
          period,
        })}
        onKeyDown={(event) => moveFocus(event, index + 1)}
        onClick={() => onSelectDay(date)}
      >
        <span className={styles.dayNumber}>{index + 1}</span>
        {!compact && <Plus className={styles.dayAdd} aria-hidden="true" />}
        <DayEntries compact={compact} items={items} kind={kind} />
      </TooltipTrigger>
      {data && (
        <DayTooltip
          date={date}
          info={info}
          vacation={vacation}
          vacationLabel={vacationLabel}
          outside={outside}
          period={period}
        />
      )}
    </Tooltip>
  );
}
function dayKind(info: DayInfo | null, vacation: ReturnType<typeof vacationAt>): string {
  if (info?.kind === "holiday") return "holiday";
  if (info && vacation) return "vacation";
  return info?.kind ?? "loading";
}
type DayDescription = {
  info: DayInfo | null;
  vacation: ReturnType<typeof vacationAt>;
  vacationLabel: string;
  unavailable?: boolean;
};
function dayLabel({ info, vacation, vacationLabel, unavailable }: DayDescription): string {
  if (info) return vacation && info.kind !== "holiday" ? vacationLabel : info.label;
  return unavailable ? "datas indisponíveis" : "carregando";
}
function dayAriaLabel({
  date,
  year,
  outside,
  period,
  ...description
}: DayDescription & {
  date: string;
  year: number;
  outside: boolean;
  period: CalendarPeriod | null;
}): string {
  return `${fullDate(date)} de ${year} · ${dayLabel(description)}${outside ? ` · fora de ${period?.name}` : ""}`;
}
function DayEntries({
  compact,
  items,
  kind,
}: {
  compact: boolean;
  items: CalendarEntry[];
  kind: string;
}): ReactElement {
  return compact ? (
    <span className={styles.markers} aria-hidden="true">
      {[...new Set(items.map((item) => item.kind))].map((marker) => (
        <i key={marker} data-kind={marker} />
      ))}
    </span>
  ) : (
    <span className={styles.dayEntries} aria-hidden="true">
      {items.slice(0, VISIBLE_ENTRIES).map((item) => (
        <span key={item.key} data-kind={item.kind}>
          {item.title}
        </span>
      ))}
      {items.length > VISIBLE_ENTRIES && (
        <small>+{items.length - VISIBLE_ENTRIES} nesta data</small>
      )}
      {items.length === 0 && kind === "vacation" && <small>Férias acadêmicas</small>}
      {items.length === 0 && kind === "unknown" && <small>Sem período</small>}
    </span>
  );
}
function DayTooltip({
  date,
  info,
  vacation,
  vacationLabel,
  outside,
  period,
}: DayDescription & {
  date: string;
  outside: boolean;
  period: CalendarPeriod | null;
}): ReactElement {
  return (
    <TooltipContent>
      <strong>{fullDate(date)}</strong>
      <p>{vacation && info?.kind !== "holiday" ? vacationLabel : info?.label}</p>
      <p>{dayTooltipDetail(info, vacation)}</p>
      {outside && (
        <p>
          {outsideLabel(vacation)} {period?.name}
        </p>
      )}
    </TooltipContent>
  );
}
function MonthFooter({
  data,
  monthVacation,
  period,
  outsideMonth,
  monthEntries,
  disabled,
  onOpenMonth,
  unavailable,
}: Pick<MonthGridProps, "data" | "period" | "disabled" | "onOpenMonth" | "unavailable"> &
  Pick<MonthModel, "monthVacation" | "outsideMonth" | "monthEntries">): ReactElement {
  if (!data) return <MonthUnavailable unavailable={unavailable} />;
  if (monthVacation)
    return (
      <span className={styles.vacationLabel} data-before={monthVacation === "before"}>
        {monthVacation === "before" ? "Férias anteriores" : `Férias após ${period?.name}`}
      </span>
    );
  if (outsideMonth) return <span>Fora de {period?.name}</span>;
  if (monthEntries.length === 0) return <span>Sem eventos neste mês</span>;
  return (
    <button type="button" disabled={disabled} onClick={onOpenMonth}>
      {monthEntries.length} {monthEntries.length === 1 ? "data importante" : "datas importantes"}
      <ArrowUpRight aria-hidden="true" />
    </button>
  );
}

function MonthDays({ count, context }: { count: number; context: DayContext }): ReactElement {
  return (
    <>
      {Array.from({ length: count }, (_value, index) => (
        <MonthDay
          key={isoDay({ year: context.year, month: context.month, day: index + 1 })}
          index={index}
          context={context}
        />
      ))}
    </>
  );
}
function useMonthFocus({ year, month, count }: { year: number; month: number; count: number }): {
  ref: RefObject<HTMLDivElement | null>;
  moveFocus: DayContext["moveFocus"];
} {
  const ref = useRef<HTMLDivElement>(null);
  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, day: number): void {
    const next = keyboardDay(event.key, { day, count });
    if (next === null) return;
    event.preventDefault();
    ref.current
      ?.querySelector<HTMLButtonElement>(
        `[data-date="${isoDay({ year, month, day: Math.max(1, Math.min(count, next)) })}"]`,
      )
      ?.focus();
  }
  return { ref, moveFocus };
}

function monthFocusDay({
  selected,
  today,
  first,
}: {
  selected: string | null;
  today: string;
  first: string;
}): string {
  const prefix = first.slice(0, MONTH_PREFIX_LENGTH);
  if (selected?.startsWith(prefix)) return selected;
  return today.startsWith(prefix) ? today : first;
}
function isOutsidePeriod(date: string, period: CalendarPeriod | null): boolean {
  return Boolean(
    period && (date < civilDate(period.startDate) || date > civilDate(period.endDate)),
  );
}
function dayTooltipDetail(
  info: DayInfo | null,
  vacation: ReturnType<typeof vacationAt>,
): string | undefined {
  if (info?.kind === "holiday")
    return "Dia inteiro · aulas, atendimentos e experimentais suspensos.";
  return vacation
    ? "Sem aulas regulares. Atendimentos fora do período exigem confirmação."
    : info?.detail;
}
function outsideLabel(vacation: ReturnType<typeof vacationAt>): string {
  if (vacation === "before") return "Antes de";
  return vacation === "after" ? "Após" : "Fora de";
}

function MonthUnavailable({ unavailable }: { unavailable: boolean | undefined }): ReactElement {
  return (
    <span className={unavailable ? undefined : styles.loadingLabel}>
      {unavailable ? "Datas indisponíveis" : "Carregando datas…"}
    </span>
  );
}

function MonthBody({
  gridRef,
  count,
  context,
}: {
  gridRef: RefObject<HTMLDivElement | null>;
  count: number;
  context: DayContext;
}): ReactElement {
  const { offset } = context;
  return (
    <TooltipProvider delay={TOOLTIP_DELAY}>
      <div ref={gridRef} className={styles.days}>
        {Array.from({ length: offset }, (_value, index) => (
          <span className={styles.blankDay} key={`blank-${index}`} />
        ))}
        <MonthDays count={count} context={context} />
        {Array.from(
          { length: (DAYS_PER_WEEK - ((offset + count) % DAYS_PER_WEEK)) % DAYS_PER_WEEK },
          (_value, index) => (
            <span className={styles.blankDay} key={`after-${index}`} />
          ),
        )}
      </div>
    </TooltipProvider>
  );
}

function MonthContent({
  context,
  model,
  gridRef,
  onOpenMonth,
  showYear,
}: {
  context: DayContext;
  model: MonthModel;
  gridRef: RefObject<HTMLDivElement | null>;
  onOpenMonth: MonthGridProps["onOpenMonth"];
  showYear: boolean;
}): ReactElement {
  return (
    <section
      className={styles.month}
      data-compact={context.compact}
      data-outside={model.outsideMonth}
      data-vacation={model.monthVacation ?? undefined}
      aria-label={`${MONTHS[context.month]} de ${context.year}`}
    >
      <MonthHeading
        compact={context.compact}
        disabled={context.disabled}
        onOpenMonth={onOpenMonth}
        month={context.month}
        year={context.year}
        showYear={showYear}
      />
      <MonthBody gridRef={gridRef} count={model.count} context={context} />
      {context.compact && (
        <div className={styles.monthFoot}>
          <MonthFooter
            data={context.data}
            monthVacation={model.monthVacation}
            period={context.period}
            outsideMonth={model.outsideMonth}
            monthEntries={model.monthEntries}
            disabled={context.disabled}
            onOpenMonth={onOpenMonth}
            unavailable={context.unavailable}
          />
        </div>
      )}
    </section>
  );
}
