"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Alert, Button, ScheduleCalendar } from "@lazuli/ui";
import { MONTHS, WEEKDAYS, dayInfo as sampleDayInfo, isoDay } from "./workshop-data";
import { calendarDay, type AcademicYear, type DayInfo } from "./model";
import type { ReactNode } from "react";
import { AcademicDayAgenda } from "./day-agenda";
import { CalendarInterruptionDetails } from "./interruption-details";
import styles from "./workshop.module.css";
import type { AcademicCalendarLocation } from "./navigation";

export function AcademicCalendarWorkshop({
  data,
  activeYear,
  onYearChange,
  actions,
  notice,
  onEditEvent,
  location,
  onLocationChange,
}: {
  data?: AcademicYear;
  activeYear?: number;
  onYearChange?: (year: number) => void;
  actions?: ReactNode;
  notice?: ReactNode;
  onEditEvent?: (id: string) => void;
  location?: AcademicCalendarLocation;
  onLocationChange?: (location: AcademicCalendarLocation) => void;
}) {
  const [sampleYear, setSampleYear] = useState(2026);
  const year = activeYear ?? sampleYear;
  const setYear = onYearChange ?? setSampleYear;
  const dayInfo = (date: string): DayInfo => (data ? calendarDay(date, data) : sampleDayInfo(date));
  const [sampleLocation, setSampleLocation] = useState<AcademicCalendarLocation>({
    month: null,
    date: null,
    daily: false,
  });
  const { month, date, daily } = location ?? sampleLocation;
  const setLocation = onLocationChange ?? setSampleLocation;
  function setDate(value: string) {
    if (!onLocationChange) setYear(Number(value.slice(0, 4)));
    setLocation({ month: Number(value.slice(5, 7)) - 1, date: value, daily });
  }
  function setDaily(value: boolean) {
    setLocation({
      month,
      date: date ?? (month === null ? null : isoDay(year, month, 1)),
      daily: value,
    });
  }
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    pageRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [month, daily]);
  function openMonth(value: number) {
    setLocation({ month: value, date: null, daily: false });
  }
  function reset() {
    setLocation({ month: null, date: null, daily: false });
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
        {actions && <div className={styles.headerActions}>{actions}</div>}
        <div className={styles.year}>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Ano anterior"
            disabled={year <= 2000}
            onClick={() => {
              setYear(year - 1);
              if (!onLocationChange) reset();
            }}
          >
            <ChevronLeft />
          </Button>
          <strong>{year}</strong>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Próximo ano"
            disabled={year >= 2100}
            onClick={() => {
              setYear(year + 1);
              if (!onLocationChange) reset();
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
                  Array.from(
                    { length: (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000 },
                    (_, i) => {
                      const date = new Date(Date.UTC(year, 0, i + 1)).toISOString().slice(0, 10);
                      const info = dayInfo(date);
                      return [info.kind, ...(info.markers ?? [])];
                    },
                  ).flat(),
                )
              : undefined
          }
        />
      )}
      {notice}
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
                                p.startDate < new Date(Date.UTC(year, index + 6, 1)) &&
                                p.endDate >= new Date(Date.UTC(year, index, 1)),
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
          {!daily && (
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
          )}
          {daily && displayed ? (
            <DayView
              onEditEvent={onEditEvent}
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
                    {data && <CalendarInterruptionDetails data={data} date={date} />}
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
                {data &&
                  date &&
                  data.events
                    .filter(
                      (item) =>
                        item.startsAt < new Date(`${date}T23:59:59-03:00`) &&
                        item.endsAt > new Date(`${date}T00:00:00-03:00`),
                    )
                    .map((item) => (
                      <div key={item.id}>
                        <h3>{item.title}</h3>
                        <p>
                          {item.startsAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}{" "}
                          — {item.endsAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                        </p>
                        <p>{item.description}</p>
                        <Button variant="ghost" onClick={() => onEditEvent?.(item.id)}>
                          Editar evento
                        </Button>
                      </div>
                    ))}
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
              {(info.kind !== "academic" || !!info.markers?.length) && <small>{info.label}</small>}
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
  onEditEvent,
  dayInfo,
  data,
  date,
  onDateChange,
  onBack,
}: {
  onEditEvent?: ((id: string) => void) | undefined;
  dayInfo: (date: string) => DayInfo;
  data?: AcademicYear | undefined;
  date: string;
  onDateChange: (date: string) => void;
  onBack: () => void;
}) {
  const info = dayInfo(date);
  const holiday = info.kind === "holiday";
  if (data)
    return (
      <div className={styles.dayView}>
        <CalendarInterruptionDetails data={data} date={date} />
        {(info.kind === "vacation" || info.kind === "unknown") && (
          <Alert>
            {info.kind === "vacation"
              ? "Férias acadêmicas."
              : "Esta data não pertence a um semestre configurado."}{" "}
            Atendimentos extras exigem confirmação antes de agendar.
          </Alert>
        )}
        <AcademicDayAgenda
          date={date}
          data={data}
          onDateChange={onDateChange}
          onBack={onBack}
          suspension={
            holiday
              ? data.closedDays
                  .filter((item) => item.date.toISOString().slice(0, 10) === date)
                  .map((item) => item.reason)
                  .join(" · ")
              : undefined
          }
          {...(onEditEvent ? { onEditEvent } : {})}
        />
      </div>
    );
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
            hours={{ start: "07:00", end: "22:00" }}
            events={
              info.kind === "event"
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
