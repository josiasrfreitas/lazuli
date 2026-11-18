import type { ReactElement } from "react";
import { Check, ChevronDown, ChevronRight, ArrowRight } from "lucide-react";
import { Badge, Checkbox } from "@lazuli/ui";
import { StudentAvatar } from "~/components/student-avatar";
import { formatDateOnlyBR } from "~/lib/format";
import { dateOnly } from "./shared";
import { confirmationLabels, confirmationVariants, isConfirmed } from "./confirmation";
import type { OrganizationAction, Placement, OrganizationBoard } from "./model";
import { StudentReviewDetail } from "./review-detail";
import styles from "./review.module.css";

type RowProps = {
  row: Placement;
  board: OrganizationBoard;
  selected: boolean;
  eligible: boolean;
  working: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSelection: (value: boolean) => void;
  onAction: (action: OrganizationAction) => void;
};

export function ReviewRow({
  row,
  board,
  selected,
  eligible,
  working,
  expanded,
  onToggle,
  onSelection,
  onAction,
}: RowProps): ReactElement {
  const plan = board.plans.find((item) => item.id === row.planId);
  const id = `review-${row.id}`;
  return (
    <li className={styles.row} data-expanded={expanded || undefined}>
      <div className={styles.summary}>
        <div className={styles.select}>
          {eligible ? (
            <Checkbox
              size="sm"
              aria-label={`Selecionar ${row.studentName} para alocação`}
              checked={selected}
              disabled={working}
              onCheckedChange={(value) => onSelection(Boolean(value))}
            />
          ) : row.publishedAt && !row.declinedAt ? (
            <Check size={16} aria-label="Alocação confirmada" className="text-success" />
          ) : null}
        </div>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          aria-controls={expanded ? id : undefined}
          onClick={onToggle}
        >
          <span className={styles.student}>
            <StudentAvatar name={row.studentName} colorKey={row.studentId} size="sm" />
            <strong>{row.studentName}</strong>
          </span>
          <span className={styles.route}>
            <span>{row.sourceClassName ?? "Nova entrada"}</span>
            <ArrowRight size={13} aria-hidden="true" />
            <span>{row.declinedAt ? "Saída registrada" : (plan?.name ?? "Escolher turma")}</span>
          </span>
          <span className={styles.status}>
            <Badge variant={row.declinedAt ? "neutral" : confirmationVariants[row.confirmation]}>
              {!row.declinedAt && isConfirmed(row) && <Check size={12} aria-hidden="true" />}
              {row.declinedAt ? "Saída registrada" : confirmationLabels[row.confirmation]}
            </Badge>
            <small>
              {row.publishedAt
                ? `Vigência em ${formatDateOnlyBR(dateOnly(row.effectiveDate ?? board.semester.startDate))}`
                : eligible
                  ? "Pronto para alocar"
                  : row.blockers[0]}
            </small>
          </span>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
      {expanded && (
        <div className={styles.expanded} id={id}>
          <StudentReviewDetail row={row} board={board} onAction={onAction} />
        </div>
      )}
    </li>
  );
}
