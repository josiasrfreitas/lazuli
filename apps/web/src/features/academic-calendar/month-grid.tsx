"use client";

import { useRef, type KeyboardEvent } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@lazuli/ui";
import { calendarDay, type AcademicYear } from "./model";
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
}: {
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
}) {
  const ref = useRef<HTMLDivElement>(null);
  const offset = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const outsideMonth = Boolean(
    period &&
    (isoDay(year, month, count) < civilDate(period.startDate) ||
      isoDay(year, month, 1) > civilDate(period.endDate)),
  );
  const firstVacation = vacationAt(isoDay(year, month, 1), vacations);
  const monthVacation =
    firstVacation === vacationAt(isoDay(year, month, count), vacations) ? firstVacation : null;
  const monthEntries = entriesInRange(entries, isoDay(year, month, 1), isoDay(year, month, count));
  const focusDay = selected?.startsWith(isoDay(year, month, 1).slice(0, 7))
    ? selected
    : today.startsWith(isoDay(year, month, 1).slice(0, 7))
      ? today
      : isoDay(year, month, 1);
  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, day: number) {
    const next =
      event.key === "ArrowRight"
        ? day + 1
        : event.key === "ArrowLeft"
          ? day - 1
          : event.key === "ArrowDown"
            ? day + 7
            : event.key === "ArrowUp"
              ? day - 7
              : event.key === "Home"
                ? 1
                : event.key === "End"
                  ? count
                  : null;
    if (next === null) return;
    event.preventDefault();
    ref.current
      ?.querySelector<HTMLButtonElement>(
        `[data-date="${isoDay(year, month, Math.max(1, Math.min(count, next)))}"]`,
      )
      ?.focus();
  }
  return (
    <section
      className={styles.month}
      data-compact={compact}
      data-outside={outsideMonth}
      data-vacation={monthVacation ?? undefined}
      aria-label={`${MONTHS[month]} de ${year}`}
    >
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
      <TooltipProvider delay={350}>
        <div ref={ref} className={styles.days}>
          {Array.from({ length: offset }, (_, index) => (
            <span className={styles.blankDay} key={`blank-${index}`} />
          ))}
          {Array.from({ length: count }, (_, index) => {
            const date = isoDay(year, month, index + 1);
            const info = data ? calendarDay(date, data) : null;
            const items = entriesInRange(monthEntries, date, date);
            const vacation = vacationAt(date, vacations);
            const vacationLabel =
              vacation === "before" ? "Férias anteriores" : "Férias após o período";
            const kind =
              info?.kind === "holiday"
                ? "holiday"
                : info && vacation
                  ? "vacation"
                  : (info?.kind ?? "loading");
            const outside = Boolean(
              period && (date < civilDate(period.startDate) || date > civilDate(period.endDate)),
            );
            return (
              <Tooltip key={date}>
                <TooltipTrigger
                  render={<button type="button" />}
                  className={styles.day}
                  data-date={date}
                  data-kind={kind}
                  data-outside={outside}
                  data-vacation={vacation ?? undefined}
                  data-weekend={(offset + index) % 7 === 0 || (offset + index) % 7 === 6}
                  data-today={date === today}
                  aria-current={date === today ? "date" : undefined}
                  aria-pressed={selected === date}
                  disabled={!data || disabled}
                  tabIndex={date === focusDay ? 0 : -1}
                  aria-label={`${fullDate(date)} de ${year}${info ? ` · ${vacation && info.kind !== "holiday" ? vacationLabel : info.label}` : unavailable ? " · datas indisponíveis" : " · carregando"}${outside ? ` · fora de ${period?.name}` : ""}`}
                  onKeyDown={(event) => moveFocus(event, index + 1)}
                  onClick={() => onSelectDay(date)}
                >
                  <span className={styles.dayNumber}>{index + 1}</span>
                  {!compact && <Plus className={styles.dayAdd} aria-hidden="true" />}
                  {compact ? (
                    <span className={styles.markers} aria-hidden="true">
                      {[...new Set(items.map((item) => item.kind))].map((marker) => (
                        <i key={marker} data-kind={marker} />
                      ))}
                    </span>
                  ) : (
                    <span className={styles.dayEntries} aria-hidden="true">
                      {items.slice(0, 2).map((item) => (
                        <span key={item.key} data-kind={item.kind}>
                          {item.title}
                        </span>
                      ))}
                      {items.length > 2 && <small>+{items.length - 2} nesta data</small>}
                      {!items.length && kind === "vacation" && <small>Férias acadêmicas</small>}
                      {!items.length && kind === "unknown" && <small>Sem período</small>}
                    </span>
                  )}
                </TooltipTrigger>
                {data && (
                  <TooltipContent>
                    <strong>{fullDate(date)}</strong>
                    <p>{vacation && info?.kind !== "holiday" ? vacationLabel : info?.label}</p>
                    <p>
                      {info?.kind === "holiday"
                        ? "Dia inteiro · aulas, atendimentos e experimentais suspensos."
                        : vacation
                          ? "Sem aulas regulares. Atendimentos fora do período exigem confirmação."
                          : info?.detail}
                    </p>
                    {outside && (
                      <p>
                        {vacation === "before"
                          ? "Antes de"
                          : vacation === "after"
                            ? "Após"
                            : "Fora de"}{" "}
                        {period?.name}
                      </p>
                    )}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
          {Array.from({ length: (7 - ((offset + count) % 7)) % 7 }, (_, index) => (
            <span className={styles.blankDay} key={`after-${index}`} />
          ))}
        </div>
      </TooltipProvider>
      {compact && (
        <div className={styles.monthFoot}>
          {data && monthVacation ? (
            <span className={styles.vacationLabel} data-before={monthVacation === "before"}>
              {monthVacation === "before" ? "Férias anteriores" : `Férias após ${period?.name}`}
            </span>
          ) : data && outsideMonth ? (
            <span>Fora de {period?.name}</span>
          ) : data ? (
            monthEntries.length ? (
              <button type="button" disabled={disabled} onClick={onOpenMonth}>
                {monthEntries.length}{" "}
                {monthEntries.length === 1 ? "data importante" : "datas importantes"}
                <ArrowUpRight aria-hidden="true" />
              </button>
            ) : (
              <span>Sem eventos neste mês</span>
            )
          ) : (
            <span className={unavailable ? undefined : styles.loadingLabel}>
              {unavailable ? "Datas indisponíveis" : "Carregando datas…"}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
