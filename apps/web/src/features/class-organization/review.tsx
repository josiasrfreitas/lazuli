"use client";

import { useEffect, useMemo, type Dispatch, type ReactElement, type SetStateAction } from "react";
import { Button, EmptyState } from "@lazuli/ui";
import { ArrowLeft, ListChecks, SearchX } from "lucide-react";
import { isReadyForAllocation } from "./confirmation";
import type { ClassPlan, OrganizationAction, OrganizationBoard, Placement } from "./model";
import { reviewResults, type ChangeCriteria, type ReviewCriteria } from "./review-filters";
import { groupReviewRows } from "./review-group-model";
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

export function OrganizationReview({
  board,
  ended,
  criteria,
  changeCriteria,
  versions,
  setVersions,
  viewBatch,
  setViewBatch,
  onAction,
  onOpenPlan,
  onLead,
  onFeedback,
  onPublishing,
}: ReviewProps): ReactElement {
  const scope =
    ended && (criteria.vinculos === "ready" || criteria.vinculos === "blocked")
      ? "all"
      : (criteria.vinculos ?? "all");
  const { rows, leads, counts } = useMemo(
    () => reviewResults(board, criteria, scope, ended),
    [board, criteria, scope, ended],
  );
  const selected = useMemo(
    () =>
      board.placements.filter(
        (row) => !ended && versions.get(row.id) === row.version && isReadyForAllocation(row),
      ),
    [board.placements, ended, versions],
  );
  const selectedIds = useMemo(() => new Set(selected.map((row) => row.id)), [selected]);
  const groups = useMemo(
    () =>
      groupReviewRows(
        board,
        viewBatch ? selected : rows,
        viewBatch ? [] : leads,
        criteria.ordemVinculos,
      ),
    [board, criteria.ordemVinculos, leads, rows, selected, viewBatch],
  );

  useEffect(() => {
    if (selectedIds.size === versions.size) return;
    const dropped = Array.from(versions).filter(([id]) => !selectedIds.has(id));
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

  const publication = useReviewPublish({
    board,
    selected,
    onFeedback,
    removeSelection: (ids) =>
      setVersions((previous) => {
        const next = new Map(previous);
        for (const id of ids) next.delete(id);
        return next;
      }),
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

  const emptyPeriod =
    !board.placements.length && !board.waitingLeads.some((lead) => !ended || lead.allocationPlanId);
  const hidden = selected.length - rows.filter((row) => selectedIds.has(row.id)).length;
  const filtered = Boolean(
    criteria.busca.trim() ||
    criteria.destinoVinculo ||
    criteria.estagioVinculo ||
    criteria.origemVinculo ||
    criteria.estagioOrigem ||
    criteria.professorVinculo ||
    criteria.modalidadeVinculo ||
    criteria.atencaoVinculo ||
    criteria.saidaVinculo ||
    criteria.reducaoSignificativa ||
    criteria.turmasEmRisco ||
    criteria.precisaTurma ||
    scope !== "all",
  );
  const groupStage =
    !ended && !viewBatch && (criteria.precisaTurma || criteria.atencaoVinculo === "unassigned")
      ? criteria.estagioVinculo
      : null;

  return (
    <section
      className={styles.review}
      aria-label="Revisão dos vínculos"
      aria-busy={publication.working}
    >
      {viewBatch ? (
        <div className={styles.batchHeading}>
          <h2>Lote selecionado</h2>
          <Button
            variant="secondary"
            size="sm"
            disabled={publication.working}
            onClick={() => setViewBatch(false)}
          >
            <ArrowLeft /> Voltar aos resultados
          </Button>
        </div>
      ) : (
        <ReviewToolbar
          board={board}
          ended={ended}
          scope={scope}
          counts={counts}
          criteria={criteria}
          change={changeCriteria}
        />
      )}
      {selected.length > 0 && (
        <a href="#review-batch" className={styles.skip}>
          Ir para a confirmação do lote
        </a>
      )}
      {groupStage && (
        <div className={styles.formGroup}>
          <FormGroup
            stage={groupStage}
            stageCode={
              rows.find((row) => row.stageCode)?.stageCode ??
              leads.find((lead) => lead.stage)?.stage?.internalCode
            }
            rows={rows}
            leads={leads.filter((lead) => !lead.allocationPlanId)}
            onAction={onAction}
          />
        </div>
      )}
      <ReviewGroups
        board={board}
        groups={groups}
        ended={ended}
        working={publication.working}
        autoOpenSingle={!viewBatch && filtered}
        selectedIds={selectedIds}
        onMark={markRows}
        onOpenPlan={onOpenPlan}
        onLead={onLead}
      />
      {!groups.length && (
        <div className={styles.empty}>
          <EmptyState
            icon={viewBatch ? <ListChecks /> : <SearchX />}
            title={
              viewBatch
                ? "O lote está vazio"
                : emptyPeriod
                  ? "Nenhum vínculo neste período"
                  : "Nenhum resultado"
            }
            description={
              viewBatch
                ? "Volte aos resultados para selecionar os alunos de uma turma."
                : emptyPeriod
                  ? "Os alunos aparecerão aqui quando a formação tiver propostas."
                  : "Ajuste a busca ou os filtros para consultar outros alunos."
            }
            action={
              !viewBatch && filtered && !emptyPeriod ? (
                <Button variant="secondary" size="sm" onClick={() => changeCriteria(null)}>
                  Limpar filtros
                </Button>
              ) : undefined
            }
          />
        </div>
      )}
      {publication.error && (
        <p role="alert" className={styles.error}>
          {publication.error}
        </p>
      )}
      {!ended && selected.length > 0 && (
        <ReviewFooter
          selected={selected.length}
          plans={new Set(selected.map((row) => row.planId)).size}
          hidden={hidden}
          viewBatch={viewBatch}
          working={publication.working}
          onViewBatch={() => setViewBatch(true)}
          onConfirm={() => void confirm()}
        />
      )}
    </section>
  );
}

function FormGroup({
  stage,
  stageCode,
  rows,
  leads,
  onAction,
}: {
  stage: string;
  stageCode: string | undefined;
  rows: Placement[];
  leads: OrganizationBoard["waitingLeads"];
  onAction: ReviewProps["onAction"];
}): ReactElement | null {
  const unassigned = rows.filter((row) => !row.publishedAt);
  if (!stageCode || unassigned.length + leads.length === 0) return null;
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() =>
        onAction({ kind: "plan", group: { stageId: stage, stageCode, rows: unassigned, leads } })
      }
    >
      Formar turma de {stageCode}
    </Button>
  );
}
