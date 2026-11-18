import type { ReactElement } from "react";
import { useQueryState } from "nuqs";
import { Button, Checkbox } from "@lazuli/ui";
import type { OrganizationAction, Placement, OrganizationBoard } from "./model";
import { ReviewRow } from "./review-row";
import styles from "./review.module.css";

type ReviewProps = {
  board: OrganizationBoard;
  rows: Placement[];
  eligible: Placement[];
  selected: Placement[];
  showSelection: boolean;
  scope: "pending" | "published" | "all";
  working: boolean;
  error: string | null;
  onIds: (ids: string[]) => void;
  onSelection: (row: Placement, value: boolean) => void;
  onAction: (action: OrganizationAction) => void;
  onConfirm: () => void;
};

export function ReviewView(props: ReviewProps): ReactElement {
  const [expandedId, setExpandedId] = useQueryState("vinculo");
  const eligibleIds = new Set(props.eligible.map(({ id }) => id));
  const selectedIds = new Set(props.selected.map(({ id }) => id));
  return (
    <section className={styles.review} aria-label="Revisão dos vínculos">
      {props.error && (
        <p role="alert" className="text-destructive">
          {props.error}
        </p>
      )}
      <div className={styles.list}>
        {props.rows.length > 0 ? (
          <ul className={styles.rows}>
            {props.rows.map((row) => (
              <ReviewRow
                key={row.id}
                row={row}
                board={props.board}
                selected={selectedIds.has(row.id)}
                eligible={eligibleIds.has(row.id)}
                expanded={expandedId === row.id}
                working={props.working}
                onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)}
                onSelection={(value) => props.onSelection(row, value)}
                onAction={props.onAction}
              />
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>
            {props.scope === "published"
              ? "Nenhum aluno alocado nesta seleção."
              : "Nenhum vínculo nesta seleção."}
          </p>
        )}
      </div>
      {props.showSelection && (
        <footer className={styles.footer}>
          <label>
            <Checkbox
              size="sm"
              aria-label="Selecionar todos os vínculos prontos"
              checked={props.eligible.length > 0 && props.selected.length === props.eligible.length}
              indeterminate={
                props.selected.length > 0 && props.selected.length < props.eligible.length
              }
              disabled={!props.eligible.length || props.working}
              onCheckedChange={(value) => props.onIds(value ? [...eligibleIds] : [])}
            />
            Selecionar prontos ({props.eligible.length})
          </label>
          <Button
            size="sm"
            disabled={!props.selected.length || props.working}
            onClick={props.onConfirm}
          >
            {props.working
              ? "Confirmando…"
              : props.selected.length === 1
                ? "Confirmar 1 alocação"
                : props.selected.length
                  ? `Confirmar ${props.selected.length} alocações`
                  : "Confirmar alocações"}
          </Button>
        </footer>
      )}
    </section>
  );
}
