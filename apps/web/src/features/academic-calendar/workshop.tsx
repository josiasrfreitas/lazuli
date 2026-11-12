"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Alert,
  Button,
  ScheduleCalendar,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { MONTHS, WEEKDAYS, dayInfo, isoDay } from "./workshop-data";
import styles from "./workshop.module.css";

type Direction = "atlas" | "semesters" | "focus";
const DIRECTIONS = {
  atlas: {
    title: "Ano completo",
    description: "Doze meses juntos; os detalhes aparecem ao lado do mês escolhido.",
  },
  semesters: {
    title: "Por semestre",
    description: "O ano dividido em dois grupos; férias e limites ficam em evidência.",
  },
  focus: {
    title: "Ano → mês",
    description: "A visão anual ocupa a página; selecionar um mês abre um espaço dedicado.",
  },
};

export function AcademicCalendarWorkshop() {
  const [direction, setDirection] = useState<Direction>("focus");
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [daily, setDaily] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    pageRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [month, daily, direction]);
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
      <div className={styles.workshop}>
        <span>Estudo de layout · dados ilustrativos, sem alterações na escola</span>
        <SegmentedControl
          wrap
          aria-label="Alternativa de layout"
          value={direction}
          onValueChange={(value) => {
            if (value && value in DIRECTIONS) {
              setDirection(value as Direction);
              reset();
            }
          }}
        >
          <SegmentedControlItem value="atlas">A · Ano completo</SegmentedControlItem>
          <SegmentedControlItem value="semesters">B · Semestres</SegmentedControlItem>
          <SegmentedControlItem value="focus">C · Ano → mês</SegmentedControlItem>
        </SegmentedControl>
      </div>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Agenda</p>
          <h1>Calendário acadêmico</h1>
          <p className={styles.muted}>{DIRECTIONS[direction].description}</p>
        </div>
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
      <div className={styles.periods}>
        <span>
          <strong>1º semestre</strong> 02 fev — 30 jun
        </span>
        <span>
          <strong>Férias acadêmicas</strong> 01 jul — 02 ago
        </span>
        <span>
          <strong>2º semestre</strong> 03 ago — 18 dez
        </span>
      </div>
      <Legend />
      {month === null ? (
        <div className={styles.overview} data-direction={direction}>
          <div className={styles.months} data-direction={direction}>
            {MONTHS.map((name, index) => (
              <Fragment key={name}>
                {direction === "semesters" && index % 6 === 0 && (
                  <h2 className={styles.groupTitle}>
                    {index === 0 ? "Primeiro semestre" : "Segundo semestre"}
                  </h2>
                )}
                <div className={styles.monthBlock}>
                  <MonthGrid year={year} month={index} compact onMonth={() => openMonth(index)} />
                </div>
              </Fragment>
            ))}
          </div>
          {direction === "atlas" && (
            <aside className={styles.aside}>
              <CalendarDays />
              <h2>O ano em perspectiva</h2>
              <p>Selecione um mês para consultar seus dias e abrir a agenda.</p>
              <h3>Datas em destaque</h3>
              <p>07 set · Independência do Brasil</p>
              <p>18 set · Encontro cultural</p>
              <p className={styles.muted}>
                As datas de semestre e o evento são apenas exemplos para este estudo.
              </p>
            </aside>
          )}
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
            <DayView date={displayed} onDateChange={setDate} onBack={() => setDaily(false)} />
          ) : (
            <div className={styles.monthDetail} data-direction={direction}>
              <MonthGrid year={year} month={month} selected={date} onDay={setDate} />
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
                {month === 8 && (
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

function Legend() {
  return (
    <div className={styles.legend} aria-label="Legenda do calendário">
      {[
        ["academic", "Período acadêmico"],
        ["vacation", "Férias acadêmicas"],
        ["holiday", "Feriado / recesso"],
        ["boundary", "Início / fim do semestre"],
        ["event", "Evento"],
      ].map(([kind, label]) => (
        <span key={kind}>
          <i data-kind={kind} aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
}

function MonthGrid({
  year,
  month,
  compact = false,
  selected,
  onMonth,
  onDay,
}: {
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
            <span key={date} className={styles.day} data-kind={info.kind}>
              {i + 1}
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
  date,
  onDateChange,
  onBack,
}: {
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
