"use client";

import { useEffect, useMemo, type Dispatch, type ReactElement, type SetStateAction } from "react";
import { Button, EmptyState } from "@lazuli/ui";
import { ArrowLeft, ListChecks, SearchX } from "lucide-react";
import { isReadyForAllocation } from "./confirmation";
import type { ClassPlan, OrganizationAction, OrganizationBoard, Placement } from "./model";
import {
  reviewResults,
  type ChangeCriteria,
  type ReviewCriteria,
  type ReviewResults,
  type ReviewScope,
} from "./review-filters";
import { groupReviewRows, type ReviewGroup } from "./review-group-model";
import { ReviewGroups } from "./review-groups";
import { useReviewPublish } from "./review-publish";
import { ReviewToolbar } from "./review-toolbar";
import { ReviewFooter } from "./review-view";
import styles from "./review.module.css";

type ReviewProps = {
  board: OrganizationBoard;
  ended: boolean;
  criteria: ReviewCriteria;
  changeCriteria: ChangeCriteria;
  versions: Map<string, number>;
  setVersions: Dispatch<SetStateAction<Map<string, number>>>;
  viewBatch: boolean;
  setViewBatch: (value: boolean) => void;
  onAction: (action: OrganizationAction) => void;
  onOpenPlan: (plan: ClassPlan) => void;
  onLead: (id: string) => void;
  onFeedback: (text: string) => void;
  onPublishing: (working: boolean) => void;
};

type ReviewSelection = {
  selected: Placement[];
  selectedIds: ReadonlySet<string>;
  markRows: (items: Placement[], checked: boolean) => void;
  removeSelection: (ids: readonly string[]) => void;
};

function useReviewSelection({
  board,
  ended,
  versions,
  setVersions,
  onFeedback,
}: ReviewProps): ReviewSelection {
  const selected = useMemo(
    () =>
      board.placements.filter(
        (row) => !ended && versions.get(row.id) === row.version && isReadyForAllocation(row),
      ),
    [board.placements, ended, versions],
  );
  const selectedIds = useMemo(() => new Set(selected.map((row) => row.id)), [selected]);

  useEffect(() => {
    if (selectedIds.size === versions.size) return;
    const dropped = [...versions].filter(([id]) => !selectedIds.has(id));
    setVersions((previous) => {
      const next = new Map(previous);
      for (const [id, version] of dropped) {
        if (next.get(id) === version) next.delete(id);
      }
      return next;
    });
    onFeedback(
      dropped.length === 1
        ? "Uma proposta mudou e saiu do lote. Confira os dados antes de selecioná-la novamente."
        : `${dropped.length} propostas mudaram e saíram do lote. Confira os dados antes de selecioná-las novamente.`,
    );
  }, [onFeedback, selectedIds, setVersions, versions]);

  function markRows(items: Placement[], checked: boolean): void {
    setVersions((previous) => {
      const next = new Map(previous);
      for (const row of items) {
        if (checked) next.set(row.id, row.version);
        else next.delete(row.id);
      }
      return next;
    });
  }

  function removeSelection(ids: readonly string[]): void {
    setVersions((previous) => {
      const next = new Map(previous);
      for (const id of ids) next.delete(id);
      return next;
    });
  }

  return { selected, selectedIds, markRows, removeSelection };
}

function hasReviewFilters(criteria: ReviewCriteria, scope: ReviewScope): boolean {
  return [
    criteria.busca.trim(),
    criteria.destinoVinculo,
    criteria.estagioVinculo,
    criteria.origemVinculo,
    criteria.estagioOrigem,
    criteria.professorVinculo,
    criteria.modalidadeVinculo,
    criteria.atencaoVinculo,
    criteria.saidaVinculo,
    criteria.reducaoSignificativa,
    criteria.turmasEmRisco,
    criteria.precisaTurma,
    scope !== "all",
  ].some(Boolean);
}

function activeScope(scope: ReviewScope | null, ended: boolean): ReviewScope {
  if (ended && (scope === "ready" || scope === "blocked")) return "all";
  return scope ?? "all";
}

export function OrganizationReview(props: ReviewProps): ReactElement {
  const { board, ended, criteria, viewBatch, setVersions, setViewBatch, onFeedback, onPublishing } =
    props;
  const scope = activeScope(criteria.vinculos, ended);
  const results = useMemo(
    () => reviewResults(board, { criteria, scope, ended }),
    [board, criteria, scope, ended],
  );
  const selection = useReviewSelection(props);
  const { selected, selectedIds } = selection;
  const groups = useMemo(
    () =>
      groupReviewRows(board, {
        rows: viewBatch ? selected : results.rows,
        leads: viewBatch ? [] : results.leads,
        order: criteria.ordemVinculos,
      }),
    [board, criteria.ordemVinculos, results, selected, viewBatch],
  );
  const publication = useReviewPublish({
    board,
    selected,
    onFeedback,
    removeSelection: selection.removeSelection,
    clearSelection: () => {
      setVersions(new Map());
      setViewBatch(false);
    },
  });
  async function confirm(): Promise<void> {
    onPublishing(true);
    try {
      await publication.confirm();
    } finally {
      onPublishing(false);
    }
  }

  return (
    <section
      className={styles.review}
      aria-label="Revisão dos vínculos"
      aria-busy={publication.working}
    >
      <ReviewHeading
        {...props}
        scope={scope}
        counts={results.counts}
        working={publication.working}
      />
      {selected.length > 0 && (
        <a href="#review-batch" className={styles.skip}>
          Ir para a confirmação do lote
        </a>
      )}
      <ReviewBoardResults
        {...props}
        results={results}
        groups={groups}
        selection={selection}
        working={publication.working}
        filtered={hasReviewFilters(criteria, scope)}
      />
      <PublicationStatus
        {...props}
        selection={selected}
        selectedIds={selectedIds}
        visibleRows={results.rows}
        publication={publication}
        confirm={confirm}
      />
    </section>
  );
}

function ReviewHeading({
  viewBatch,
  setViewBatch,
  working,
  board,
  ended,
  scope,
  counts,
  criteria,
  changeCriteria,
}: Pick<
  ReviewProps,
  "viewBatch" | "setViewBatch" | "board" | "ended" | "criteria" | "changeCriteria"
> & {
  scope: ReviewScope;
  counts: ReviewResults["counts"];
  working: boolean;
}): ReactElement {
  if (viewBatch)
    return (
      <div className={styles.batchHeading}>
        <h2>Lote selecionado</h2>
        <Button
          variant="secondary"
          size="sm"
          disabled={working}
          onClick={() => setViewBatch(false)}
        >
          <ArrowLeft /> Voltar aos resultados
        </Button>
      </div>
    );
  return (
    <ReviewToolbar
      board={board}
      ended={ended}
      scope={scope}
      counts={counts}
      criteria={criteria}
      change={changeCriteria}
    />
  );
}

function ReviewBoardResults({
  board,
  ended,
  criteria,
  viewBatch,
  onOpenPlan,
  onLead,
  onAction,
  changeCriteria,
  results,
  groups,
  selection,
  working,
  filtered,
}: ReviewProps & {
  results: ReviewResults;
  groups: ReviewGroup[];
  selection: ReviewSelection;
  working: boolean;
  filtered: boolean;
}): ReactElement {
  const { rows, leads } = results;
  const groupStage =
    !ended && !viewBatch && (criteria.precisaTurma || criteria.atencaoVinculo === "unassigned")
      ? criteria.estagioVinculo
      : null;
  return (
    <>
      {groupStage && (
        <div className={styles.formGroup}>
          <FormGroup stage={groupStage} rows={rows} leads={leads} onAction={onAction} />
        </div>
      )}
      <ReviewGroups
        board={board}
        groups={groups}
        ended={ended}
        working={working}
        autoOpenSingle={!viewBatch && filtered}
        selectedIds={selection.selectedIds}
        onMark={selection.markRows}
        onOpenPlan={onOpenPlan}
        onLead={onLead}
      />
      {groups.length === 0 && (
        <ReviewEmpty
          board={board}
          ended={ended}
          viewBatch={viewBatch}
          filtered={filtered}
          changeCriteria={changeCriteria}
        />
      )}
    </>
  );
}

const emptyReviewCopy = {
  batch: {
    title: "O lote está vazio",
    description: "Volte aos resultados para selecionar os alunos de uma turma.",
  },
  period: {
    title: "Nenhum vínculo neste período",
    description: "Os alunos aparecerão aqui quando a formação tiver propostas.",
  },
  filters: {
    title: "Nenhum resultado",
    description: "Ajuste a busca ou os filtros para consultar outros alunos.",
  },
} as const;

function ReviewEmpty({
  board,
  ended,
  viewBatch,
  filtered,
  changeCriteria,
}: Pick<ReviewProps, "board" | "ended" | "viewBatch" | "changeCriteria"> & {
  filtered: boolean;
}): ReactElement {
  const emptyPeriod =
    board.placements.length === 0 &&
    !board.waitingLeads.some((lead) => !ended || lead.allocationPlanId);
  let copy: (typeof emptyReviewCopy)[keyof typeof emptyReviewCopy] = emptyReviewCopy.filters;
  if (viewBatch) copy = emptyReviewCopy.batch;
  else if (emptyPeriod) copy = emptyReviewCopy.period;
  return (
    <div className={styles.empty}>
      <EmptyState
        icon={viewBatch ? <ListChecks /> : <SearchX />}
        {...copy}
        action={
          !viewBatch && filtered && !emptyPeriod ? (
            <Button variant="secondary" size="sm" onClick={() => changeCriteria(null)}>
              Limpar filtros
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

function PublicationStatus({
  selection,
  selectedIds,
  visibleRows,
  ended,
  viewBatch,
  setViewBatch,
  publication,
  confirm,
}: Pick<ReviewProps, "ended" | "viewBatch" | "setViewBatch"> & {
  selection: Placement[];
  selectedIds: ReadonlySet<string>;
  visibleRows: Placement[];
  publication: ReturnType<typeof useReviewPublish>;
  confirm: () => Promise<void>;
}): ReactElement {
  return (
    <>
      {publication.error && (
        <p role="alert" className={styles.error}>
          {publication.error}
        </p>
      )}
      {!ended && selection.length > 0 && (
        <ReviewFooter
          selected={selection.length}
          plans={new Set(selection.map((row) => row.planId)).size}
          hidden={selection.length - visibleRows.filter((row) => selectedIds.has(row.id)).length}
          viewBatch={viewBatch}
          working={publication.working}
          onViewBatch={() => setViewBatch(true)}
          onConfirm={() => void confirm()}
        />
      )}
    </>
  );
}

function FormGroup({
  stage,
  rows,
  leads,
  onAction,
}: {
  stage: string;
  rows: Placement[];
  leads: OrganizationBoard["waitingLeads"];
  onAction: ReviewProps["onAction"];
}): ReactElement | null {
  const stageCode =
    rows.find((row) => row.stageCode)?.stageCode ??
    leads.find((lead) => lead.stage)?.stage?.internalCode;
  const unassigned = rows.filter((row) => !row.publishedAt);
  const waiting = leads.filter((lead) => !lead.allocationPlanId);
  if (!stageCode || unassigned.length + waiting.length === 0) return null;
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() =>
        onAction({
          kind: "plan",
          group: { stageId: stage, stageCode, rows: unassigned, leads: waiting },
        })
      }
    >
      Formar turma de {stageCode}
    </Button>
  );
}
