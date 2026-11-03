import { useState, type ReactElement } from "react";
import {
  ArrowRight,
  ChevronDown,
  FilePenLine,
  Inbox,
  ClipboardList,
  CalendarCheck,
} from "lucide-react";
import { Button } from "@lazuli/ui";
import { PendingDisclosure } from "~/features/admin-home/home-pending-disclosure";
import styles from "~/features/admin-home/home-pending.module.css";
import { formatDateOnlyBR } from "~/lib/format";
import {
  PendingPagination,
  PENDING_PAGE_SIZE,
} from "~/features/admin-home/home-pending-pagination";
import type { PendingLesson } from "./home-parts";
import type { HomeState } from "./home-state";

const URGENT_APPOINTMENT_DAYS = 7;
type PlacementVisit = NonNullable<HomeState["home"]["data"]>["visits"][number];

export function TeacherHomePending({
  home,
  pending,
  onOpen,
  onLesson,
  onAppointment,
}: {
  home: HomeState["home"];
  pending: HomeState["pending"];
  onLesson: (id: string) => void;
  onAppointment: (id: string) => void;
  onOpen: (id: string) => void;
}): ReactElement {
  const items =
    home.data?.visits.filter((visit) => visit.kind === "PLACEMENT" && visit.correctionPending) ??
    [];
  const appointments = home.data?.pendingAppointments ?? [];
  return (
    <section className={styles.pending} data-sticky="false" aria-labelledby="teacher-pending-title">
      <header className={styles.heading}>
        <h2 id="teacher-pending-title">Pendências</h2>
      </header>
      <div className={styles.scrollport}>
        <div id="registros" tabIndex={-1}>
          <LessonStatus pending={pending} onLesson={onLesson} />
        </div>
        <PlacementStatus home={home} items={items} onOpen={onOpen} />
        {appointments.length > 0 && (
          <AppointmentPending items={appointments} onOpen={onAppointment} />
        )}
        {teacherPendingIsEmpty({
          home,
          pending,
          itemCount: items.length,
          appointmentCount: appointments.length,
        }) && (
          <div className={styles.empty}>
            <Inbox aria-hidden="true" />
            <p>Nenhuma pendência neste período.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function teacherPendingIsEmpty(input: {
  home: HomeState["home"];
  pending: HomeState["pending"];
  itemCount: number;
  appointmentCount: number;
}): boolean {
  return (
    input.home.isSuccess &&
    input.pending.isSuccess &&
    input.itemCount === 0 &&
    input.appointmentCount === 0 &&
    input.pending.data.length === 0
  );
}

function LessonStatus({
  pending,
  onLesson,
}: {
  pending: HomeState["pending"];
  onLesson: (id: string) => void;
}): ReactElement | null {
  if (pending.isPending)
    return (
      <p role="status" className={styles.feedback}>
        Carregando aulas sem registro…
      </p>
    );
  if (pending.isError)
    return (
      <div role="alert" className={styles.feedback}>
        <p>Não foi possível carregar as aulas sem registro.</p>
        <Button variant="ghost" size="sm" onClick={() => void pending.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  if (!pending.data || pending.data.length === 0) return null;
  return <LessonPending lessons={pending.data} onOpen={onLesson} />;
}

function PlacementStatus({
  home,
  items,
  onOpen,
}: {
  home: HomeState["home"];
  items: PlacementVisit[];
  onOpen: (id: string) => void;
}): ReactElement | null {
  if (home.isPending)
    return (
      <p role="status" className={styles.feedback}>
        Carregando pendências…
      </p>
    );
  if (home.isError)
    return (
      <div role="alert" className={styles.feedback}>
        <p>Não foi possível carregar suas pendências.</p>
        <Button variant="ghost" size="sm" onClick={() => void home.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  if (items.length === 0) return null;
  return (
    <PendingDisclosure summary={<PlacementSummary count={items.length} />}>
      <ul className={styles.lessonList}>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`${styles.placementCase} w-full text-left`}
              onClick={() => onOpen(item.id)}
            >
              <strong className={styles.caseName}>{item.studentName}</strong>
              <span className={styles.preview}>{formatDateOnlyBR(item.date)}</span>
              <span className={styles.action}>
                Corrigir <ArrowRight aria-hidden="true" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </PendingDisclosure>
  );
}

function PlacementSummary({ count }: { count: number }): ReactElement {
  return (
    <>
      <span className={styles.icon}>
        <FilePenLine aria-hidden="true" />
      </span>
      <span className={styles.identity}>
        <strong>Nivelamentos para corrigir</strong>
        <span>
          {count} {count === 1 ? "prova atribuída a você" : "provas atribuídas a você"}
        </span>
      </span>
      <span className={styles.action}>
        <ChevronDown aria-hidden="true" />
      </span>
    </>
  );
}

function LessonPending({
  lessons,
  onOpen,
}: {
  lessons: PendingLesson[];
  onOpen: (id: string) => void;
}): ReactElement {
  const [requestedPage, setPage] = useState(1);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(lessons.length / PENDING_PAGE_SIZE)));
  return (
    <PendingDisclosure summary={<LessonSummary count={lessons.length} />}>
      <ul className={styles.lessonList}>
        {lessons.slice((page - 1) * PENDING_PAGE_SIZE, page * PENDING_PAGE_SIZE).map((lesson) => (
          <li key={lesson.id}>
            <button
              type="button"
              className={`${styles.placementCase} w-full text-left`}
              onClick={() => onOpen(lesson.id)}
            >
              <strong className={styles.caseName}>{lesson.className}</strong>
              <span className={styles.preview}>
                {formatDateOnlyBR(lesson.date)} · {lesson.startTime}–{lesson.endTime}
              </span>
              <span className={styles.action}>
                Registrar aula <ArrowRight aria-hidden="true" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <PendingPagination
        total={lessons.length}
        page={page}
        onPageChange={setPage}
        label="Paginação de aulas sem registro"
      />
    </PendingDisclosure>
  );
}

function LessonSummary({ count }: { count: number }): ReactElement {
  return (
    <>
      <span className={`${styles.icon} ${styles.recordIcon}`}>
        <ClipboardList aria-hidden="true" />
      </span>
      <span className={styles.identity}>
        <strong>Aulas sem registro</strong>
        <span>
          {count} {count === 1 ? "aula" : "aulas"}
        </span>
      </span>
      <span className={styles.action}>
        <ChevronDown aria-hidden="true" />
      </span>
    </>
  );
}

function AppointmentPending({
  items,
  onOpen,
}: {
  items: NonNullable<HomeState["home"]["data"]>["pendingAppointments"];
  onOpen: (id: string) => void;
}): ReactElement {
  const [requestedPage, setPage] = useState(1);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(items.length / PENDING_PAGE_SIZE)));
  return (
    <PendingDisclosure summary={<AppointmentSummary count={items.length} />}>
      <ul className={styles.lessonList}>
        {items.slice((page - 1) * PENDING_PAGE_SIZE, page * PENDING_PAGE_SIZE).map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`${styles.placementCase} w-full text-left`}
              onClick={() => onOpen(item.id)}
            >
              <strong className={styles.caseName}>{item.studentName}</strong>
              <span className={styles.preview}>
                {formatDateOnlyBR(item.date)} · {item.startTime}–{item.endTime}
              </span>
              <span
                className={
                  item.ageDays >= URGENT_APPOINTMENT_DAYS ? styles.highPriority : styles.preview
                }
              >
                {item.ageDays >= URGENT_APPOINTMENT_DAYS ? "Muito atrasado · " : ""}Há{" "}
                {item.ageDays} dias
              </span>
              <span className={styles.action}>
                Registrar atendimento <ArrowRight aria-hidden="true" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <PendingPagination
        total={items.length}
        page={page}
        onPageChange={setPage}
        label="Paginação de atendimentos sem registro"
      />
    </PendingDisclosure>
  );
}

function AppointmentSummary({ count }: { count: number }): ReactElement {
  return (
    <>
      <span className={`${styles.icon} ${styles.recordIcon}`}>
        <CalendarCheck aria-hidden="true" />
      </span>
      <span className={styles.identity}>
        <strong>Atendimento sem registro</strong>
        <span>
          {count} {count === 1 ? "atendimento" : "atendimentos"}
        </span>
      </span>
      <span className={styles.action}>
        <ChevronDown aria-hidden="true" />
      </span>
    </>
  );
}
