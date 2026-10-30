import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, MessageSquare, HeartPulse } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import type { HomeGroup } from "./home-parts";
import { PendingDisclosure } from "./home-pending-disclosure";
import { PendingPagination, PENDING_PAGE_SIZE } from "./home-pending-pagination";
import styles from "./home-pending.module.css";

const REFRESH_INTERVAL_MS = 60_000;

export function PendingOccurrences({
  group,
  kind = "occurrences",
}: {
  group: HomeGroup | undefined;
  kind?: "occurrences" | "health";
}): ReactElement | null {
  const health = kind === "health";
  const subject = health ? "alunos" : "ocorrências";
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const query = trpc.dashboard.pending.useQuery(
    { kind, page, pageSize: PENDING_PAGE_SIZE },
    { enabled: open, refetchInterval: open ? REFRESH_INTERVAL_MS : false },
  );
  const total = pendingTotal({ open, loaded: query.data?.total, initial: group?.total });
  useEffect(() => {
    if (!query.data) return;
    const lastPage = Math.max(1, Math.ceil(query.data.total / PENDING_PAGE_SIZE));
    if (page > lastPage) setPage(lastPage);
  }, [query.data, page]);
  if (!open && total === 0) return null;
  return (
    <tr>
      <td className={styles.cell}>
        <PendingDisclosure
          onOpenChange={setOpen}
          summary={<OccurrenceSummary health={health} total={total} />}
        >
          <OccurrenceContent
            health={health}
            subject={subject}
            total={total}
            page={page}
            onPageChange={setPage}
            data={query.data}
            pending={query.isPending}
            error={query.isError}
            onRetry={() => void query.refetch()}
          />
        </PendingDisclosure>
      </td>
    </tr>
  );
}

function pendingTotal(input: {
  open: boolean;
  loaded: number | undefined;
  initial: number | undefined;
}): number {
  return (input.open ? input.loaded : undefined) ?? input.initial ?? 0;
}

function occurrenceNoun(health: boolean, total: number): string {
  if (health) return total === 1 ? "aluno" : "alunos";
  return total === 1 ? "ocorrência" : "ocorrências";
}

function OccurrenceSummary({ health, total }: { health: boolean; total: number }): ReactElement {
  const Icon = health ? HeartPulse : MessageSquare;
  return (
    <>
      <span className={styles.icon}>
        <Icon aria-hidden="true" />
      </span>
      <span className={styles.identity}>
        <strong>{health ? "Score baixo" : "Ocorrências pendentes"}</strong>
        <span>
          {total} {occurrenceNoun(health, total)} ·{" "}
          {health ? "score baixo ou em observação" : "abertas ou em acompanhamento"}
        </span>
      </span>
      <span className={styles.action}>
        <ChevronDown aria-hidden="true" />
      </span>
    </>
  );
}

type OccurrenceContentProps = {
  health: boolean;
  subject: string;
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  data: RouterOutputs["dashboard"]["pending"] | undefined;
  pending: boolean;
  error: boolean;
  onRetry: () => void;
};

function OccurrenceContent(props: OccurrenceContentProps): ReactElement {
  const { health, subject, total, page, onPageChange, data, pending, error, onRetry } = props;
  return (
    <>
      <OccurrenceFeedback subject={subject} pending={pending} error={error} onRetry={onRetry} />
      {data && (
        <>
          <ul className={styles.lessonList}>
            {data.items.map(
              (item) =>
                item.action.kind === "link" && (
                  <li key={item.id}>
                    <Link href={item.action.href} className={styles.appointmentCase}>
                      <strong className={styles.caseName}>{item.title}</strong>
                      <span className={styles.preview}>{item.detail}</span>
                      {item.date && (
                        <span className={styles.preview}>
                          {health ? "Em observação até" : "Registro em"}{" "}
                          {formatDateOnlyBR(item.date)}
                        </span>
                      )}
                      <span className={styles.action}>
                        Acompanhar <ArrowRight aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                ),
            )}
            {total === 0 && <li className={styles.feedback}>Nenhuma pendência nesta lista.</li>}
          </ul>
          <PendingPagination
            total={total}
            page={page}
            onPageChange={onPageChange}
            label={`Paginação de ${subject}`}
          />
        </>
      )}
    </>
  );
}

function OccurrenceFeedback({
  subject,
  pending,
  error,
  onRetry,
}: Pick<OccurrenceContentProps, "subject" | "pending" | "error" | "onRetry">): ReactElement {
  return (
    <>
      {pending && (
        <p className={styles.feedback} role="status">
          Carregando {subject}…
        </p>
      )}
      {error && (
        <p className={styles.feedback} role="alert">
          Não foi possível atualizar a lista.{" "}
          <button type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        </p>
      )}
    </>
  );
}
