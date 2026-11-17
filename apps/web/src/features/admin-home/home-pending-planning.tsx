import { useState, type ReactElement } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, ChevronDown } from "lucide-react";
import { trpc } from "~/lib/trpc";
import type { HomeGroup } from "./home-parts";
import { PendingDisclosure } from "./home-pending-disclosure";
import { PendingIcon } from "./home-pending-icon";
import { PendingPagination, PENDING_PAGE_SIZE } from "./home-pending-pagination";
import styles from "./home-pending.module.css";

export function PendingPlanning({ group }: { group: HomeGroup | undefined }): ReactElement | null {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const query = trpc.dashboard.pending.useQuery(
    { kind: "planning", page, pageSize: PENDING_PAGE_SIZE },
    { enabled: open, refetchInterval: open ? 60_000 : false },
  );
  const visibleGroup = open ? (query.data ?? group) : group;
  const total = visibleGroup?.total ?? 0;
  if (!open && total === 0) return null;
  return (
    <tr>
      <td className={styles.cell}>
        <PendingDisclosure
          onOpenChange={setOpen}
          summary={
            <>
              <PendingIcon icon={BookOpen} className={styles.planningIcon} attention />
              <span className={styles.identity}>
                <strong>Turmas com planejamento a revisar</strong>
                <span>
                  {total} {total === 1 ? "turma" : "turmas"} · itens fora do período letivo
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
              Carregando turmas…
            </p>
          )}
          {query.isError && (
            <p className={styles.feedback} role="alert">
              Não foi possível atualizar as turmas.{" "}
              <button type="button" onClick={() => void query.refetch()}>
                Tentar novamente
              </button>
            </p>
          )}
          {query.data && (
            <ul className={styles.lessonList}>
              {query.data.items.map((item) => (
                <li key={item.id}>
                  {item.action.kind === "link" && (
                    <Link
                      href={item.action.href}
                      className={`${styles.appointmentCase} ${styles.planningCase}`}
                      aria-label={`Abrir planejamento de ${item.title}. ${item.detail}`}
                    >
                      <strong className={styles.caseName}>{item.title}</strong>
                      <span className={styles.preview}>{item.detail}</span>
                      <span className={styles.action}>
                        Ver planejamento <ArrowRight aria-hidden="true" />
                      </span>
                    </Link>
                  )}
                </li>
              ))}
              {total === 0 && (
                <li className={styles.feedback}>
                  Nenhuma turma com planejamento fora do período letivo.
                </li>
              )}
            </ul>
          )}
          <PendingPagination
            total={total}
            page={page}
            onPageChange={setPage}
            label="Paginação de turmas com planejamento a revisar"
          />
        </PendingDisclosure>
      </td>
    </tr>
  );
}
