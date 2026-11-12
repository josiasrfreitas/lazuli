"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Alert, Button, ScheduleCalendar } from "@lazuli/ui";
import { MONTHS, WEEKDAYS, dayInfo as sampleDayInfo, isoDay } from "./workshop-data";
import { calendarDay, type AcademicYear, type DayInfo } from "./model";
import type { ReactNode } from "react";
import styles from "./workshop.module.css";

export function AcademicCalendarWorkshop({
  data,
  activeYear,
  onYearChange,
  actions,
}: {
  data?: AcademicYear;
  activeYear?: number;
  onYearChange?: (year: number) => void;
  actions?: ReactNode;
}) {
  const [sampleYear, setSampleYear] = useState(2026);
  const year = activeYear ?? sampleYear;
  const setYear = onYearChange ?? setSampleYear;
  const dayInfo = (date: string): DayInfo => (data ? calendarDay(date, data) : sampleDayInfo(date));
  const [month, setMonth] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [daily, setDaily] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    pageRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [month, daily]);
  function openMonth(value: number) {
    setMonth(value);
    setDate(null);
    setDaily(false);
  }
  function reset() {
    setMonth(null);
    setDate(null);
    setDaily(false);
  }
  const displayed = month === null ? null : (date ?? isoDay(year, month, 1));
  return (
    <div ref={pageRef} className={styles.page}>
      <header className={styles.header}>
        <h1>
          <span className={styles.titleFull}>Calendário acadêmico</span>
          <span className={styles.titleShort}>Calendário</span>
        </h1>
        {!data && <span className={styles.sample}>Prévia · dados ilustrativos</span>}
        {actions}
        <div className={styles.year}>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Ano anterior"
            onClick={() => {
              setYear(year - 1);
              reset();
            }}
          >
            <ChevronLeft />
          </Button>
          <strong>{year}</strong>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Próximo ano"
            onClick={() => {
              setYear(year + 1);
              reset();
            }}
          >
            <ChevronRight />
          </Button>
        </div>
      </header>
      {month === null && (
        <Legend
          kinds={
            data
              ? new Set(
                  Array.from({ length: 366 }, (_, i) => {
                    const date = new Date(Date.UTC(year, 0, i + 1)).toISOString().slice(0, 10);
                    const info = dayInfo(date);
                    return [info.kind, ...(info.markers ?? [])];
                  }).flat(),
                )
              : undefined
          }
        />
      )}
      {month === null ? (
        <div className={styles.overview} data-direction="semesters">
          <div className={styles.months} data-direction="semesters">
            {MONTHS.map((name, index) => (
              <Fragment key={name}>
                {index % 6 === 0 && (
                  <h2 className={styles.groupTitle}>
                    {index === 0 ? "1º semestre" : "2º semestre"}
                    <small>
                      {data
                        ? data.periods
                            .filter(
                              (p) =>
                                p.startDate.getUTCFullYear() === year &&
                                (p.startDate.getUTCMonth() < 6 ? 0 : 6) === index,
                            )
                            .map(
                              (p) =>
                                `${p.startDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })} — ${p.endDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`,
                            )
                            .join(" · ")
                        : index === 0
                          ? "02 fev — 30 jun"
                          : "03 ago — 18 dez"}
                    </small>
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
      ) : (
        <section className={styles.detail}>
          <div className={styles.detailToolbar}>
            <Button variant="ghost" onClick={reset}>
              <ArrowLeft />
              Voltar ao ano
            </Button>
            <div className={styles.monthNav}>
              <Button
                size="icon"
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
                size="icon"
                variant="ghost"
                aria-label="Próximo mês"
                disabled={month === 11}
                onClick={() => openMonth(month + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
          {daily && displayed ? (
            <DayView
              dayInfo={dayInfo}
              data={data}
              date={displayed}
              onDateChange={setDate}
              onBack={() => setDaily(false)}
            />
          ) : (
            <div className={styles.monthDetail} data-direction="semesters">
              <MonthGrid
                dayInfo={dayInfo}
                year={year}
                month={month}
                selected={date}
                onDay={setDate}
              />
              <aside className={styles.aside}>
                {date ? (
                  <>
                    <p className={styles.eyebrow}>
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "full",
                        timeZone: "UTC",
                      }).format(new Date(`${date}T12:00:00Z`))}
                    </p>
                    <h2>{dayInfo(date).label}</h2>
                    <p>{dayInfo(date).detail}</p>
                    <Button onClick={() => setDaily(true)}>
                      Ver agenda do dia
                      <ArrowRight />
                    </Button>
                  </>
                ) : (
                  <>
                    <h2>Selecione um dia</h2>
                    <p>
                      Consulte o período, os recessos e os eventos. Abra a agenda para ver os
                      horários.
                    </p>
                  </>
                )}
                {!data && month === 8 && (
                  <div className={styles.dates}>
                    <h3>Neste mês</h3>
                    <Button variant="ghost" onClick={() => setDate(isoDay(year, 8, 7))}>
                      07 · Independência do Brasil
                    </Button>
                    <Button variant="ghost" onClick={() => setDate(isoDay(year, 8, 18))}>
                      18 · Encontro cultural · 18h–20h
                    </Button>
                  </div>
                )}
              </aside>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Legend({ kinds }: { kinds?: Set<string> }) {
  return (
    <div className={styles.legend} aria-label="Legenda do calendário">
      {[
        ["vacation", "Férias acadêmicas"],
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
  selected,
  onMonth,
  onDay,
}: {
  dayInfo: (date: string) => DayInfo;
  year: number;
  month: number;
  compact?: boolean;
  selected?: string | null;
  onMonth?: () => void;
  onDay?: (date: string) => void;
}) {
  const offset = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const content = (
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
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const date = isoDay(year, month, i + 1);
          const info = dayInfo(date);
          return compact ? (
            <span
              key={date}
              className={styles.day}
              data-kind={info.kind}
              title={`${i + 1} de ${MONTHS[month]} · ${info.label}`}
            >
              {i + 1}
              {!!info.markers?.length && (
                <span className={styles.markers} aria-hidden="true">
                  {info.markers.map((kind) => (
                    <i key={kind} data-kind={kind} />
                  ))}
                </span>
              )}
            </span>
          ) : (
            <button
              type="button"
              key={date}
              className={styles.day}
              data-kind={info.kind}
              aria-pressed={date === selected}
              aria-label={`${i + 1} de ${MONTHS[month]}, ${info.label}`}
              onClick={() => onDay?.(date)}
            >
              <span>{i + 1}</span>
              {info.kind !== "academic" && <small>{info.label}</small>}
            </button>
          );
        })}
      </div>
    </>
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

function DayView({
  dayInfo,
  data,
  date,
  onDateChange,
  onBack,
}: {
  dayInfo: (date: string) => DayInfo;
  data?: AcademicYear | undefined;
  date: string;
  onDateChange: (date: string) => void;
  onBack: () => void;
}) {
  const info = dayInfo(date);
  const holiday = info.kind === "holiday";
  return (
    <div className={styles.dayView}>
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft />
        Voltar ao mês
      </Button>
      {holiday ? (
        <div className={styles.holidayGrid}>
          <div className={styles.holidayTitle}>
            <CalendarDays />
            <h2>{info.label}</h2>
            <p>Dia inteiro · sem atividades acadêmicas</p>
          </div>
          {Array.from({ length: 15 }, (_, i) => (
            <div className={styles.hour} key={i}>
              <span>{String(i + 7).padStart(2, "0")}:00</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          {info.kind === "vacation" && (
            <Alert>
              Férias acadêmicas. Atendimentos extras exigem confirmação antes de agendar.
            </Alert>
          )}
          <ScheduleCalendar
            date={date}
            view="day"
            onDateChange={onDateChange}
            onViewChange={() => undefined}
            hours={data ? { start: "00:00", end: "24:00" } : { start: "07:00", end: "22:00" }}
            events={
              data
                ? data.events
                    .filter(
                      (e) =>
                        e.startsAt < new Date(`${date}T23:59:59-03:00`) &&
                        e.endsAt > new Date(`${date}T00:00:00-03:00`),
                    )
                    .map((e) => ({
                      id: e.id,
                      date,
                      title: e.title,
                      startTime:
                        e.startsAt < new Date(`${date}T00:00:00-03:00`)
                          ? "00:00"
                          : e.startsAt.toLocaleTimeString("pt-BR", {
                              timeZone: "America/Sao_Paulo",
                              hour: "2-digit",
                              minute: "2-digit",
                            }),
                      endTime:
                        e.endsAt >= new Date(`${date}T23:59:59-03:00`)
                          ? "24:00"
                          : e.endsAt.toLocaleTimeString("pt-BR", {
                              timeZone: "America/Sao_Paulo",
                              hour: "2-digit",
                              minute: "2-digit",
                            }),
                      tone: "info" as const,
                    }))
                : info.kind === "event"
                  ? [
                      {
                        id: "workshop-cultural",
                        date,
                        startTime: "18:00",
                        endTime: "20:00",
                        title: "Encontro cultural",
                        subtitle: "Evento ilustrativo",
                        tone: "info",
                      },
                    ]
                  : []
            }
            widthBehavior="fit"
            emptyDisplay="grid"
            label="Agenda do dia — estudo de calendário"
          />
        </>
      )}
    </div>
  );
}
