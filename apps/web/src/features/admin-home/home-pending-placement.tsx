import { useState, type ReactElement } from "react";
import Link from "next/link";
import { ChevronDown, FilePenLine, ArrowRight } from "lucide-react";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { HomeGroup } from "./home-parts";
import { PendingDisclosure } from "./home-pending-disclosure";
import styles from "./home-pending.module.css";

const PAGE_SIZE = 2;
const REFRESH_MS = 60_000;
const DAY_MS = 86_400_000;

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
        const days = item.date
          ? Math.max(0, Math.round((Date.parse(today) - Date.parse(item.date)) / DAY_MS))
          : null;
        return (
          <li key={item.id}>
            <Link href={item.action.href} className={styles.placementCase}>
              <strong className={styles.caseName}>{item.title}</strong>
              {item.date && (
                <span className={styles.preview}>
                  Recebida em {item.date.split("-").toReversed().slice(0, 2).join("/")}
                </span>
              )}
              {days !== null && (
                <span className={styles.preview}>
                  {days === 0 ? "Hoje" : `Há ${days} ${days === 1 ? "dia" : "dias"}`}
                </span>
              )}
              <span className={styles.action}>
                Corrigir <ArrowRight aria-hidden="true" />
              </span>
            </Link>
          </li>
        );
      })}
      {group.total === 0 && <li className={styles.feedback}>Nenhuma prova aguardando correção.</li>}
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
        <strong>Nivelamentos para corrigir</strong>
        <span>
          {total} {total === 1 ? "prova" : "provas"}
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
        Carregando provas…
      </p>
    );
  if (error)
    return (
      <p className={styles.feedback}>
        Não foi possível carregar as provas.{" "}
        <button type="button" onClick={retry}>
          Tentar novamente
        </button>
      </p>
    );
  return null;
}
