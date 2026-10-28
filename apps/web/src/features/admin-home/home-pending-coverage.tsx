import { useState, type ReactElement } from "react";
import Link from "next/link";
import { ArrowRight, UsersRound } from "lucide-react";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { RouterOutputs } from "@lazuli/api";
import type { HomeGroup, HomeItem } from "./home-parts";
import styles from "./home-pending.module.css";

const PAGE_SIZE = 3;

export function PendingCoverage({ group }: { group: HomeGroup | undefined }): ReactElement | null {
  const [page, setPage] = useState(1);
  const query = trpc.dashboard.pending.useQuery(
    { kind: "coverage", page, pageSize: PAGE_SIZE },
    { enabled: page > 1 },
  );
  const { total, items } = coveragePageState(page, { group, data: query.data });
  if (total === 0) return null;
  return (
    <>
      {items.map((item) => (
        <CoverageRow key={item.id} item={item} />
      ))}
      <CoverageFeedback
        page={page}
        pending={query.isPending}
        error={query.isError}
        onRetry={() => void query.refetch()}
      />
      {total > PAGE_SIZE && (
        <tr>
          <td className={styles.cell}>
            <CoveragePagination
              total={total}
              page={page}
              busy={query.isFetching}
              onPageChange={setPage}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function coveragePageState(
  page: number,
  {
    group,
    data,
  }: {
    group: HomeGroup | undefined;
    data: RouterOutputs["dashboard"]["pending"] | undefined;
  },
): { total: number; items: HomeItem[] } {
  return {
    total: data?.total ?? group?.total ?? 0,
    items: page === 1 ? (group?.items ?? []) : (data?.items ?? []),
  };
}

function CoverageFeedback({
  page,
  pending,
  error,
  onRetry,
}: {
  page: number;
  pending: boolean;
  error: boolean;
  onRetry: () => void;
}): ReactElement | null {
  if (page === 1) return null;
  if (pending)
    return (
      <tr>
        <td className={styles.feedback} role="status">
          Carregando turmas sem professor…
        </td>
      </tr>
    );
  if (error)
    return (
      <tr>
        <td className={styles.feedback}>
          Não foi possível carregar as turmas.{" "}
          <button type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        </td>
      </tr>
    );
  return null;
}

function CoverageRow({ item }: { item: HomeItem }): ReactElement | null {
  if (item.action.kind !== "link") return null;
  return (
    <tr>
      <td className={styles.cell}>
        <Link className={styles.item} href={item.action.href}>
          <span className={styles.icon}>
            <UsersRound aria-hidden="true" />
          </span>
          <span className={styles.identity}>
            <strong className={styles.title}>
              Turma sem professor <span>· {item.stageName ?? item.title}</span>
              {item.studentCount !== undefined && (
                <span className={styles.fact}>
                  {item.studentCount} {item.studentCount === 1 ? "aluno" : "alunos"}
                </span>
              )}
            </strong>
            <span className={styles.context}>
              <span>{item.detail}</span>
              {item.departedTeacherName && <span>{item.departedTeacherName} saiu</span>}
            </span>
          </span>
          {item.timing?.kind === "meeting" && (
            <span className={styles.when}>
              Próxima aula · {item.timing.date.split("-").toReversed().slice(0, 2).join("/")} às{" "}
              {item.timing.startTime}
            </span>
          )}
          <span className={styles.action}>
            Definir professor <ArrowRight aria-hidden="true" />
          </span>
        </Link>
      </td>
    </tr>
  );
}

export function CoveragePagination({
  total,
  page,
  busy,
  onPageChange,
}: {
  total: number;
  page: number;
  busy: boolean;
  onPageChange: (page: number) => void;
}): ReactElement | null {
  if (total <= PAGE_SIZE) return null;
  return (
    <nav className={styles.placementPagination} aria-label="Paginação de turmas sem professor">
      <span>
        {total} turmas sem professor · Página {page} de {Math.ceil(total / PAGE_SIZE)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={page === 1 || busy}
        onClick={() => onPageChange(page - 1)}
      >
        Anterior
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={page * PAGE_SIZE >= total || busy}
        onClick={() => onPageChange(page + 1)}
      >
        Próxima
      </Button>
    </nav>
  );
}
