"use client";
import { useState, type ReactElement } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import { Button } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { QueryLoading } from "~/components/query-loading";
import { RecordState } from "~/features/class-records/shared";
import { AppointmentBadge, purposes } from "./shared";
import { StudentAppointmentDialog } from "./student-appointment-dialog";
import { useHorizontalCarousel } from "./use-horizontal-carousel";
import { sortStudentAppointments } from "./student-agenda-model";
import { AppointmentsLoading } from "~/features/students/profile/student-loading";
import styles from "./student-carousel.module.css";
type Row = RouterOutputs["appointments"]["forStudent"][number];
type CarouselControls = ReturnType<typeof useHorizontalCarousel>;
export function StudentAppointmentCarousel({
  studentId,
  admin,
  onSchedule,
  hideEmpty = false,
}: {
  studentId: string;
  admin: boolean;
  hideEmpty?: boolean;
  onSchedule: () => void;
}): ReactElement | null {
  const query = trpc.appointments.forStudent.useQuery({ studentId });
  if (query.isPending)
    return hideEmpty ? (
      <QueryLoading label="Consultando atendimentos anteriores" />
    ) : (
      <AppointmentsLoading canSchedule={admin} />
    );
  if (query.isError)
    return (
      <RecordState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
    );
  if (hideEmpty && query.data.length === 0) return null;
  return (
    <Carousel
      rows={sortStudentAppointments(query.data)}
      readOnly={hideEmpty}
      studentId={studentId}
      admin={admin}
      onSchedule={onSchedule}
    />
  );
}
function Carousel({
  rows,
  readOnly,
  studentId,
  admin,
  onSchedule,
}: {
  rows: Row[];
  readOnly: boolean;
  studentId: string;
  admin: boolean;
  onSchedule: () => void;
}): ReactElement {
  const controls = useHorizontalCarousel(rows.length);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <section className={styles.agenda} aria-label="Atendimentos do aluno">
      <header className={styles.heading}>
        <h2>
          <CalendarDays aria-hidden="true" />
          Atendimentos <span>{rows.length}</span>
        </h2>
        <CarouselActions
          controls={controls}
          studentId={studentId}
          admin={admin}
          onSchedule={onSchedule}
        />
      </header>
      {rows.length === 0 && (
        <p className="py-3 text-caption text-muted-foreground">Nenhum atendimento registrado.</p>
      )}
      <CarouselRail rows={rows} controls={controls} selected={selected} onSelect={setSelected} />
      {selected && (
        <StudentAppointmentDialog
          readOnly={readOnly}
          key={selected}
          id={selected}
          admin={admin}
          onSelect={setSelected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
function CarouselRail({
  rows,
  controls,
  selected,
  onSelect,
}: {
  rows: Row[];
  controls: CarouselControls;
  selected: string | null;
  onSelect: (id: string) => void;
}): ReactElement {
  return (
    <ul
      ref={controls.rail}
      className={styles.rail}
      data-count={rows.length}
      onScroll={controls.measure}
      aria-label="Datas e motivos dos atendimentos"
    >
      {rows.map((row) => (
        <li key={row.id}>
          <AppointmentCell
            row={row}
            selected={selected === row.id}
            onSelect={() => onSelect(row.id)}
          />
        </li>
      ))}
    </ul>
  );
}
function CarouselActions({
  controls,
  studentId,
  admin,
  onSchedule,
}: {
  controls: CarouselControls;
  studentId: string;
  admin: boolean;
  onSchedule: () => void;
}): ReactElement {
  return (
    <div className={styles.actions}>
      <Button
        size="sm"
        variant="link"
        nativeButton={false}
        render={<Link href={`/aulas?aluno=${studentId}`} />}
      >
        <CalendarDays aria-hidden="true" />
        Ver agenda
      </Button>
      {admin && (
        <Button size="sm" variant="secondary" onClick={onSchedule}>
          <CalendarDays aria-hidden="true" />
          Agendar atendimento
        </Button>
      )}
      <CarouselArrows controls={controls} />
    </div>
  );
}
function CarouselArrows({ controls }: { controls: CarouselControls }): ReactElement | null {
  if (controls.start && controls.end) return null;
  return (
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Atendimentos anteriores"
        disabled={controls.start}
        onClick={() => controls.scroll(-1)}
      >
        <ArrowLeft />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Próximos atendimentos"
        disabled={controls.end}
        onClick={() => controls.scroll(1)}
      >
        <ArrowRight />
      </Button>
    </>
  );
}
function AppointmentCell({
  row,
  selected,
  onSelect,
}: {
  row: Row;
  selected: boolean;
  onSelect: () => void;
}): ReactElement {
  const date = new Date(`${row.date}T12:00:00Z`);
  const month = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return (
    <button
      id={`appointment-cell-${row.id}`}
      type="button"
      className={styles.cell}
      aria-haspopup="dialog"
      aria-expanded={selected}
      onClick={onSelect}
    >
      <time dateTime={row.date} className={styles.date}>
        <strong>{date.getUTCDate()}</strong>
        <span>{month}</span>
      </time>
      <span className={styles.body}>
        <strong>{purposes[row.purpose]}</strong>
        <span className={styles.reason}>
          {row.plannedContent || row.performedContent || "Motivo não registrado."}
        </span>
        <span className={styles.meta}>
          <small>
            {row.startTime}–{row.endTime}
          </small>
          <AppointmentBadge
            status={row.status}
            overdue={row.overdue}
            rescheduled={Boolean(row.rescheduledToId)}
          />
        </span>
      </span>
    </button>
  );
}
