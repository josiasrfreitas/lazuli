import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, MessageSquare, HeartPulse } from "lucide-react";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import type { HomeGroup } from "./home-parts";
import { PendingDisclosure } from "./home-pending-disclosure";
import { PendingPagination, PENDING_PAGE_SIZE } from "./home-pending-pagination";
import styles from "./home-pending.module.css";

export function PendingOccurrences({
  group,
  kind = "occurrences",
}: {
  group: HomeGroup | undefined;
  kind?: "occurrences" | "health";
}): ReactElement | null {
  const health = kind === "health";
  const Icon = health ? HeartPulse : MessageSquare;
  const label = health ? "Score baixo" : "Ocorrências pendentes";
  const subject = health ? "alunos" : "ocorrências";
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const query = trpc.dashboard.pending.useQuery(
    { kind, page, pageSize: PENDING_PAGE_SIZE },
    { enabled: open, refetchInterval: open ? 60_000 : false },
  );
  const total = (open ? query.data?.total : undefined) ?? group?.total ?? 0;
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
          summary={
            <>
              <span className={styles.icon}>
                <Icon aria-hidden="true" />
              </span>
              <span className={styles.identity}>
                <strong>{label}</strong>
                <span>
                  {total}{" "}
                  {health
                    ? total === 1
                      ? "aluno"
                      : "alunos"
                    : total === 1
                      ? "ocorrência"
                      : "ocorrências"}
                  {" · "}
                  {health ? "score baixo ou em observação" : "abertas ou em acompanhamento"}
                </span>
              </span>
              <span className={styles.action}>
                <ChevronDown aria-hidden="true" />
              </span>
            </>
          }
        >
          {query.isPending && (
            <p className={styles.feedback} role="status">
              Carregando {subject}…
            </p>
          )}
          {query.isError && (
            <p className={styles.feedback} role="alert">
              Não foi possível atualizar a lista.{" "}
              <button type="button" onClick={() => void query.refetch()}>
                Tentar novamente
              </button>
            </p>
          )}
          {query.data && (
            <>
              <ul className={styles.lessonList}>
                {query.data.items.map(
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
                onPageChange={setPage}
                label={`Paginação de ${subject}`}
              />
            </>
          )}
        </PendingDisclosure>
      </td>
    </tr>
  );
}
