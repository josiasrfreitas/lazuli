import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { followsOwnClass } from "@lazuli/domain";
import { Badge, Checkbox } from "@lazuli/ui";
import { StudentAvatar } from "~/components/student-avatar";
import { rosterAttentionReasons } from "./attention-reasons";
import { FormationReason } from "./formation-reason";
import { responseLabels } from "./confirmation";
import type { ClassPlan, OrganizationBoard, Placement } from "./model";
import { isReviewDeparture, reviewPlanName } from "./review-group-model";
import { reviewStatus } from "./review-model";
import styles from "./review-groups.module.css";

type RowProps = {
  row: Placement;
  plan: ClassPlan | undefined;
  board: OrganizationBoard;
  ended: boolean;
  eligible: boolean;
  selected: boolean;
  working: boolean;
  href: string;
  onNavigate?: () => void;
  onSelection: (row: Placement, value: boolean) => void;
};

export function ReviewRow({
  row,
  plan,
  board,
  ended,
  eligible,
  selected,
  working,
  href,
  onNavigate,
  onSelection,
}: RowProps): ReactElement {
  const detailId = `review-case-${row.id}`;
  const checkboxId = `review-select-student-${row.id}`;
  const publishedPlan =
    row.publishedAt && row.planId && row.planId !== plan?.id
      ? board.plans.find((candidate) => candidate.id === row.planId)
      : undefined;
  const age =
    row.studentAge == null
      ? "Idade não informada"
      : `${row.studentAge} ${row.studentAge === 1 ? "ano" : "anos"}`;
  const score = row.attention.healthScore;
  const context = [
    age,
    score == null ? "Score indisponível" : `Score ${score}`,
    studentContext(row, plan),
  ]
    .filter(Boolean)
    .join(" · ");
  const description = [
    context && `${detailId}-context`,
    publishedPlan && `${detailId}-plan`,
    `${detailId}-status`,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <li className={styles.student} data-selected={selected || undefined}>
      <div className={styles.studentBar}>
        <div className={styles.pick}>
          {eligible && (
            <label htmlFor={checkboxId} className={styles.studentSelection}>
              <Checkbox
                id={checkboxId}
                size="md"
                aria-labelledby={`${checkboxId}-label`}
                checked={selected}
                disabled={working}
                onCheckedChange={(value) => onSelection(row, Boolean(value))}
              />
              <span id={`${checkboxId}-label`} className="sr-only">
                Selecionar {row.studentName} para alocação
              </span>
            </label>
          )}
        </div>
        <Link
          href={href}
          scroll={false}
          prefetch={false}
          id={`review-student-${row.id}`}
          className={styles.studentLink}
          aria-label={`Abrir ficha de ${row.studentName}`}
          aria-describedby={description}
          onNavigate={() => onNavigate?.()}
        >
          <span className={styles.person}>
            <StudentAvatar name={row.studentName} colorKey={row.studentId} size="sm" />
            <span className={styles.personName}>
              <strong>{row.studentName}</strong>
              {context && <small id={`${detailId}-context`}>{context}</small>}
              {publishedPlan && (
                <small id={`${detailId}-plan`}>
                  {row.declinedAt ? "Última alocação" : "Turma confirmada"} ·{" "}
                  {reviewPlanName(publishedPlan)}
                </small>
              )}
            </span>
          </span>
          <span className={styles.situation} id={`${detailId}-status`}>
            <RowStatus row={row} ended={ended} />
          </span>
          <ArrowRight className={styles.studentArrow} aria-hidden="true" size={15} />
        </Link>
      </div>
    </li>
  );
}

function studentContext(row: Placement, plan: ClassPlan | undefined): string {
  if (isReviewDeparture(row)) {
    const origin = plan && row.sourceClassId !== plan.classId ? row.sourceClassName : null;
    const stage = row.sourceStageName ?? row.sourceStageCode;
    return [origin && `Origem · ${origin}`, stage && `Estágio de origem · ${stage}`]
      .filter(Boolean)
      .join(" · ");
  }
  const sameGroup = followsOwnClass(row.sourceClassId, plan ?? null);
  const origin = row.sourceClassName ? `Origem · ${row.sourceClassName}` : null;
  const stage = row.stageName ?? row.stageCode ?? "A definir";
  const individualStage =
    !plan || plan.scheduleType === "PERSONALIZED" || plan.sharedStageId !== row.stageId;
  return [
    row.mode === "ENTRY" ? "Nova entrada" : !sameGroup && origin,
    individualStage && `Destino · ${stage}`,
    row.mode === "REPEAT" && "Repete o estágio",
  ]
    .filter(Boolean)
    .join(" · ");
}

function RowStatus({ row, ended }: Pick<RowProps, "row" | "ended">): ReactElement {
  const { label, variant, impliedBlocker } = reviewStatus(row, ended);
  const reasons = row.declinedAt ? [] : rosterAttentionReasons(row);
  const blockers = reasons.filter((reason) => reason.blocker);
  const showBlocker =
    blockers.length > 0 &&
    (variant === "destructive" || (row.confirmation === "BLOCKED" && !!impliedBlocker));
  const visible = [
    ...blockers.filter((reason) => showBlocker || reason.blocker !== impliedBlocker),
    ...reasons.filter(
      ({ blocker, risk }) =>
        !blocker &&
        (risk === "lowHealth" ||
          risk === "incomplete" ||
          risk === "missingAttendance" ||
          risk === "other"),
    ),
  ];
  const changedResponse =
    row.publishedAt &&
    !row.declinedAt &&
    (row.continuity === "CHANGE" || row.continuity === "LEAVING")
      ? responseLabels[row.continuity]
      : null;
  return (
    <>
      {showBlocker ? (
        <span className="sr-only">{label}.</span>
      ) : (
        <Badge variant={variant}>{label}</Badge>
      )}
      {changedResponse && <small>{changedResponse}</small>}
      {visible.map((reason) => (
        <FormationReason key={reason.risk} reason={reason} />
      ))}
    </>
  );
}
