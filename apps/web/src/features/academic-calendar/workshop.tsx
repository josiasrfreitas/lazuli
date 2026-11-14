"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@lazuli/ui";
import { MONTHS, WEEKDAYS, dayInfo as sampleDayInfo, isoDay } from "./workshop-data";
import { calendarDay, type AcademicYear, type DayInfo } from "./model";
import type { ReactNode, ReactElement, RefObject } from "react";
import styles from "./workshop.module.css";
import type { AcademicCalendarLocation } from "./navigation";

type WorkshopProps = {
  data?: AcademicYear;
  activeYear?: number;
  onYearChange?: (year: number) => void;
  actions?: ReactNode;
  notice?: ReactNode;
  onEditEvent?: (id: string) => void;
  location?: AcademicCalendarLocation;
  onLocationChange?: (location: AcademicCalendarLocation) => void;
};
const SAMPLE_YEAR = 2026;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const DAY_MS = 86_400_000;
const DATE_LENGTH = 10;
const SEMESTER_MONTHS = 6;
const LAST_MONTH = 11;
type WorkshopState = {
  year: number;
  setYear: (year: number) => void;
  month: number | null;
  dayInfo: (date: string) => DayInfo;
  pageRef: RefObject<HTMLDivElement | null>;
  openMonth: (month: number) => void;
  reset: () => void;
};
type WorkshopViewProps = { props: WorkshopProps; state: WorkshopState };
export function AcademicCalendarWorkshop(props: WorkshopProps): ReactElement {
  const state = useWorkshopState(props);
  const { pageRef, month } = state;
  const { data, notice } = props;
  return (
    <div ref={pageRef} className={styles.page}>
      <WorkshopHeader props={props} state={state} />
      {month === null && <Legend kinds={data ? workshopKinds(state) : undefined} />}
      {notice}
      {month === null ? (
        <WorkshopOverview props={props} state={state} />
      ) : (
        <WorkshopDetail props={props} state={{ ...state, month }} />
      )}
    </div>
  );
}
function useWorkshopState({
  data,
  activeYear,
  onYearChange,
  location,
  onLocationChange,
}: WorkshopProps): WorkshopState {
  const [sampleYear, setSampleYear] = useState(SAMPLE_YEAR);
  const year = activeYear ?? sampleYear;
  const setYear = onYearChange ?? setSampleYear;
  const dayInfo = (date: string): DayInfo => (data ? calendarDay(date, data) : sampleDayInfo(date));
  const [sampleLocation, setSampleLocation] = useState<AcademicCalendarLocation>({
    month: null,
    date: null,
    daily: false,
  });
  const { month } = location ?? sampleLocation;
  const setLocation = onLocationChange ?? setSampleLocation;
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    pageRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [month]);
  function openMonth(value: number): void {
    setLocation({ month: value, date: null, daily: false });
  }
  function reset(): void {
    setLocation({ month: null, date: null, daily: false });
  }
  return { year, setYear, month, dayInfo, pageRef, openMonth, reset };
}
function WorkshopHeader({
  props: { data, actions, onLocationChange },
  state: { year, setYear, reset },
}: WorkshopViewProps): ReactElement {
  return (
    <header className={styles.header}>
      <h1>
        <span className={styles.titleFull}>Calendário acadêmico</span>
        <span className={styles.titleShort}>Calendário</span>
      </h1>
      {!data && <span className={styles.sample}>Prévia · dados ilustrativos</span>}
      {actions && <div className={styles.headerActions}>{actions}</div>}
      <div className={styles.year}>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Ano anterior"
          disabled={year <= MIN_YEAR}
          onClick={() => {
            setYear(year - 1);
            if (!onLocationChange) reset();
          }}
        >
          <ChevronLeft />
        </Button>
        <strong>{year}</strong>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Próximo ano"
          disabled={year >= MAX_YEAR}
          onClick={() => {
            setYear(year + 1);
            if (!onLocationChange) reset();
          }}
        >
          <ChevronRight />
        </Button>
      </div>
    </header>
  );
}
function WorkshopOverview({
  props: { data },
  state: { year, dayInfo, openMonth },
}: WorkshopViewProps): ReactElement {
  return (
    <div className={styles.overview} data-direction="semesters">
      <div className={styles.months} data-direction="semesters">
        {MONTHS.map((name, index) => (
          <Fragment key={name}>
            {index % SEMESTER_MONTHS === 0 && (
              <h2 className={styles.groupTitle}>
                {index === 0 ? "1º semestre" : "2º semestre"}
                <small>{semesterRange({ data, year, index })}</small>
              </h2>
            )}
            <div className={styles.monthBlock}>
              <MonthGrid
                dayInfo={dayInfo}
                year={year}
                month={index}
                compact
                onMonth={() => openMonth(index)}
              />
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
function WorkshopDetail({
  props: { data, onEditEvent },
  state: { year, month, reset, openMonth, dayInfo },
}: {
  props: WorkshopProps;
  state: WorkshopState & { month: number };
}): ReactElement {
  return (
    <section className={styles.detail}>
      <div className={styles.detailToolbar}>
        <Button variant="ghost" onClick={reset}>
          <ArrowLeft />
          Voltar ao ano
        </Button>
        <div className={styles.monthNav}>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Mês anterior"
            disabled={month === 0}
            onClick={() => openMonth(month - 1)}
          >
            <ChevronLeft />
          </Button>
          <h2>
            {MONTHS[month]} {year}
          </h2>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Próximo mês"
            disabled={month === LAST_MONTH}
            onClick={() => openMonth(month + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      <MonthGrid dayInfo={dayInfo} year={year} month={month} />
      {data?.events
        .filter(
          (item) =>
            item.startsAt <
              new Date(
                `${new Date(Date.UTC(year, month + 1, 1)).toISOString().slice(0, DATE_LENGTH)}T00:00:00-03:00`,
              ) && item.endsAt >= new Date(`${isoDay({ year, month, day: 1 })}T00:00:00-03:00`),
        )
        .map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4">
            <div>
              <h3>{item.title}</h3>
              <p className="text-caption text-muted-foreground">
                {item.startsAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                {" — "}
                {item.endsAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              </p>
            </div>
            <Button variant="ghost" onClick={() => onEditEvent?.(item.id)}>
              <Pencil aria-hidden="true" /> Editar evento
            </Button>
          </div>
        ))}
    </section>
  );
}
function workshopKinds({ year, dayInfo }: WorkshopState): Set<string> {
  return new Set(
    Array.from(
      { length: (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY_MS },
      (_value, index) => {
        const date = new Date(Date.UTC(year, 0, index + 1)).toISOString().slice(0, DATE_LENGTH);
        const info = dayInfo(date);
        return [info.kind, ...(info.markers ?? [])];
      },
    ).flat(),
  );
}

function Legend({ kinds }: { kinds?: Set<string> | undefined }): ReactElement {
  return (
    <div className={styles.legend} aria-label="Legenda do calendário">
      {[
        ["vacation", "Férias acadêmicas"],
        ["unknown", "Período não configurado"],
        ["holiday", "Feriado / recesso"],
        ["boundary", "Início / fim do semestre"],
        ["event", "Evento"],
      ]
        .filter(([kind]) => !kinds || kinds.has(kind!))
        .map(([kind, label]) => (
          <span key={kind}>
            <i data-kind={kind} aria-hidden="true" />
            {label}
          </span>
        ))}
    </div>
  );
}

function MonthGrid({
  dayInfo,
  year,
  month,
  compact = false,
  onMonth,
}: {
  dayInfo: (date: string) => DayInfo;
  year: number;
  month: number;
  compact?: boolean;
  onMonth?: () => void;
}): ReactElement {
  const offset = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const content = (
    <MonthContent
      dayInfo={dayInfo}
      year={year}
      month={month}
      compact={compact}
      offset={offset}
      count={count}
    />
  );

  return compact ? (
    <button
      type="button"
      className={styles.month}
      data-compact="true"
      aria-label={`Abrir ${MONTHS[month]} de ${year}`}
      onClick={onMonth}
    >
      {content}
    </button>
  ) : (
    <div className={styles.month}>{content}</div>
  );
}

function semesterRange({
  data,
  year,
  index,
}: {
  data: AcademicYear | undefined;
  year: number;
  index: number;
}): string {
  if (!data) return index === 0 ? "02 fev — 30 jun" : "03 ago — 18 dez";
  return data.periods
    .filter(
      (period) =>
        period.startDate < new Date(Date.UTC(year, index + SEMESTER_MONTHS, 1)) &&
        period.endDate >= new Date(Date.UTC(year, index, 1)),
    )
    .map(
      (period) =>
        `${period.startDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })} — ${period.endDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`,
    )
    .join(" · ");
}

function MonthContent({
  dayInfo,
  year,
  month,
  compact,
  offset,
  count,
}: {
  dayInfo: (date: string) => DayInfo;
  year: number;
  month: number;
  compact: boolean;
  offset: number;
  count: number;
}): ReactElement {
  return (
    <>
      <div className={styles.monthHeading}>
        <h3>{MONTHS[month]}</h3>
        {compact && <ArrowRight aria-hidden="true" />}
      </div>
      <div className={styles.days}>
        {WEEKDAYS.map((day) => (
          <span className={styles.weekday} key={day}>
            {day}
          </span>
        ))}
        {Array.from({ length: offset }, (_value, index) => (
          <span key={`blank-${index}`} />
        ))}
        {Array.from({ length: count }, (_value, index) => {
          const date = isoDay({ year, month, day: index + 1 });
          const info = dayInfo(date);
          return compact ? (
            <span
              key={date}
              className={styles.day}
              data-kind={info.kind}
              title={`${index + 1} de ${MONTHS[month]} · ${info.label}`}
            >
              {index + 1}
              {!!info.markers?.length && (
                <span className={styles.markers} aria-hidden="true">
                  {info.markers.map((kind) => (
                    <i key={kind} data-kind={kind} />
                  ))}
                </span>
              )}
            </span>
          ) : (
            <div
              key={date}
              className={styles.day}
              data-kind={info.kind}
              aria-label={`${index + 1} de ${MONTHS[month]}, ${info.label}`}
            >
              <span>{index + 1}</span>
              {(info.kind !== "academic" || !!info.markers?.length) && <small>{info.label}</small>}
            </div>
          );
        })}
      </div>
    </>
  );
}
