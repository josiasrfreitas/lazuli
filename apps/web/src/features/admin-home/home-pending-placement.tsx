import { PENDING_PAGE_SIZE as PAGE_SIZE } from "./home-pending-pagination";
import { useState, type ReactElement } from "react";
import Link from "next/link";
import { ChevronDown, FilePenLine, ArrowRight } from "lucide-react";
import { Badge, Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { HomeGroup } from "./home-parts";
import { PendingDisclosure } from "./home-pending-disclosure";
import styles from "./home-pending.module.css";

const REFRESH_MS = 60_000;

export function PendingPlacement({
  group,
  today,
}: {
  group: HomeGroup | undefined;
  today: string;
}): ReactElement | null {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const query = trpc.dashboard.pending.useQuery(
    { kind: "placement", page, pageSize: PAGE_SIZE },
    { enabled: open, refetchInterval: open ? REFRESH_MS : false },
  );
  const total = query.data?.total ?? group?.total ?? 0;
  if (!open && total === 0) return null;
  return (
    <tr>
      <td className={styles.cell}>
        <PendingDisclosure onOpenChange={setOpen} summary={<PlacementSummary total={total} />}>
          <PlacementFeedback
            pending={query.isPending}
            error={query.isError}
            retry={() => {
              void query.refetch();
            }}
          />
          {query.data && <PlacementCases group={query.data} today={today} />}
          <PlacementPagination
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

function PlacementCases({ group, today }: { group: HomeGroup; today: string }): ReactElement {
  return (
    <ul className={styles.lessonList}>
      {group.items.map((item) => {
        if (item.action.kind !== "link") return null;
        const correction = item.placementPhase === "CORRECTION";
        return (
          <li key={item.id}>
            <Link href={item.action.href} className={styles.placementCase}>
              <strong className={styles.caseName}>{item.title}</strong>
              <Badge variant="neutral">Lead</Badge>
              <Badge variant="neutral">{correction ? "Correção" : "Aplicação"}</Badge>
              <span className={styles.preview}>
                {item.date
                  ? `${correction ? "Recebida" : "Agendada"} ${item.date === today ? "hoje" : `em ${item.date.split("-").toReversed().slice(0, 2).join("/")}`}`
                  : "A agendar"}
              </span>
              <span className={styles.action}>
                {correction ? "Corrigir" : "Ver nivelamento"} <ArrowRight aria-hidden="true" />
              </span>
            </Link>
          </li>
        );
      })}
      {group.total === 0 && <li className={styles.feedback}>Nenhum nivelamento pendente.</li>}
    </ul>
  );
}

function PlacementSummary({ total }: { total: number }): ReactElement {
  return (
    <>
      <span className={`${styles.icon} ${styles.placementIcon}`}>
        <FilePenLine aria-hidden="true" />
      </span>
      <span className={styles.identity}>
        <strong>Nivelamentos pendentes</strong>
        <span>
          {total} {total === 1 ? "nivelamento" : "nivelamentos"}
        </span>
      </span>
      <span className={styles.action}>
        <ChevronDown aria-hidden="true" />
      </span>
    </>
  );
}

function PlacementPagination({
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
    <nav className={styles.placementPagination} aria-label="Paginação de nivelamentos">
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

function PlacementFeedback({
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
        Carregando nivelamentos…
      </p>
    );
  if (error)
    return (
      <p className={styles.feedback}>
        Não foi possível carregar os nivelamentos.{" "}
        <button type="button" onClick={retry}>
          Tentar novamente
        </button>
      </p>
    );
  return null;
}
