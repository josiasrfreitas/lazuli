import { PENDING_PAGE_SIZE as PAGE_SIZE } from "./home-pending-pagination";
import { useState, type ReactElement } from "react";
import Link from "next/link";
import { ChevronDown, CalendarCheck, ArrowRight } from "lucide-react";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { HomeGroup } from "./home-parts";
import { PendingDisclosure } from "./home-pending-disclosure";
import styles from "./home-pending.module.css";

const REFRESH_MS = 60_000;
const DAY_MS = 86_400_000;
const HIGH_PRIORITY_DAYS = 7;

export function PendingAppointments({
  group,
  today,
}: {
  group: HomeGroup | undefined;
  today: string;
}): ReactElement | null {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const query = trpc.dashboard.pending.useQuery(
    { kind: "appointments", page, pageSize: PAGE_SIZE },
    { enabled: open, refetchInterval: open ? REFRESH_MS : false },
  );
  const total = query.data?.total ?? appointmentTotal(group);
  if (!open && total === 0) return null;
  return (
    <tr>
      <td className={styles.cell}>
        <PendingDisclosure onOpenChange={setOpen} summary={<AppointmentSummary total={total} />}>
          <AppointmentFeedback
            pending={query.isPending}
            error={query.isError}
            retry={() => {
              void query.refetch();
            }}
          />
          {query.data && <AppointmentCases group={query.data} today={today} />}
          <AppointmentPagination
            total={total}
            page={page}
            busy={query.isFetching}
            setPage={setPage}
          />
        </PendingDisclosure>
      </td>
    </tr>
  );
}

function AppointmentCases({ group, today }: { group: HomeGroup; today: string }): ReactElement {
  return (
    <ul className={styles.lessonList}>
      {group.items.map((item) => (
        <AppointmentCase key={item.id} item={item} today={today} />
      ))}
      {group.total === 0 && <li className={styles.feedback}>Nenhum atendimento para finalizar.</li>}
    </ul>
  );
}

function AppointmentCase({
  item,
  today,
}: {
  item: HomeGroup["items"][number];
  today: string;
}): ReactElement | null {
  if (item.action.kind !== "appointment" || !item.action.studentId) return null;
  const days =
    item.ageDays ??
    (item.date
      ? Math.max(0, Math.round((Date.parse(today) - Date.parse(item.date)) / DAY_MS))
      : null);
  const high = days !== null && days >= HIGH_PRIORITY_DAYS;
  return (
    <li>
      <Link
        className={styles.appointmentCase}
        href={`/alunos/${item.action.studentId}?secao=pedagogico&atendimento=${item.id}&voltar=%2F`}
      >
        <strong className={styles.caseName}>{item.title}</strong>
        {item.date && (
          <span className={styles.preview}>
            {item.date.split("-").toReversed().slice(0, 2).join("/")} ·{" "}
            {item.detail.split(" · ")[0]}
          </span>
        )}
        {days !== null && (
          <span className={high ? styles.highPriority : styles.preview}>
            {high ? "Muito atrasado · " : ""}
            {days === 0 ? "Hoje" : `Há ${days} ${days === 1 ? "dia" : "dias"}`}
          </span>
        )}
        <span className={styles.action}>
          <ArrowRight aria-hidden="true" />
          <span className="sr-only">Abrir atendimento no aluno</span>
        </span>
      </Link>
    </li>
  );
}

function AppointmentSummary({ total }: { total: number }): ReactElement {
  return (
    <>
      <span className={`${styles.icon} ${styles.recordIcon}`}>
        <CalendarCheck aria-hidden="true" />
      </span>
      <span className={styles.identity}>
        <strong>Atendimento sem registro</strong>
        <span>
          {total} {total === 1 ? "atendimento" : "atendimentos"}
        </span>
      </span>
      <span className={styles.action}>
        <ChevronDown aria-hidden="true" />
      </span>
    </>
  );
}

function AppointmentPagination({
  total,
  page,
  busy,
  setPage,
}: {
  total: number;
  page: number;
  busy: boolean;
  setPage: (value: number) => void;
}): ReactElement | null {
  if (total <= PAGE_SIZE) return null;
  return (
    <nav className={styles.placementPagination} aria-label="Paginação de atendimentos">
      <Button
        variant="ghost"
        size="sm"
        disabled={page === 1 || busy}
        onClick={() => setPage(page - 1)}
      >
        Anterior
      </Button>
      <span>
        Página {page} de {Math.ceil(total / PAGE_SIZE)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={page * PAGE_SIZE >= total || busy}
        onClick={() => setPage(page + 1)}
      >
        Próxima
      </Button>
    </nav>
  );
}

function AppointmentFeedback({
  pending,
  error,
  retry,
}: {
  pending: boolean;
  error: boolean;
  retry: () => void;
}): ReactElement | null {
  if (pending)
    return (
      <p className={styles.feedback} role="status">
        Carregando atendimentos…
      </p>
    );
  if (error)
    return (
      <p className={styles.feedback}>
        Não foi possível carregar os atendimentos.{" "}
        <button type="button" onClick={retry}>
          Tentar novamente
        </button>
      </p>
    );
  return null;
}

function appointmentTotal(group: HomeGroup | undefined): number {
  return (group?.total ?? 0) + (group?.historyTotal ?? 0);
}
