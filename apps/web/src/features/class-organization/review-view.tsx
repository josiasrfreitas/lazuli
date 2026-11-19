import type { ReactElement } from "react";
import { Button } from "@lazuli/ui";
import { CheckCheck, ListChecks } from "lucide-react";
import styles from "./review.module.css";

type FooterProps = {
  selected: number;
  plans: number;
  hidden: number;
  viewBatch: boolean;
  working: boolean;
  onViewBatch: () => void;
  onConfirm: () => void;
};

export function ReviewFooter({
  selected,
  plans,
  hidden,
  viewBatch,
  working,
  onViewBatch,
  onConfirm,
}: FooterProps): ReactElement {
  const who = selected === 1 ? "1 aluno" : `${selected} alunos`;
  const where = plans === 1 ? "1 turma" : `${plans} turmas`;
  return (
    <footer id="review-batch" aria-label="Lote de vínculos" className={styles.footer} tabIndex={-1}>
      <div className={styles.batchSummary} role="status">
        <strong>
          {who} em {where}
        </strong>
        {hidden > 0 && !viewBatch && <span>{hidden} fora do filtro</span>}
      </div>
      <div className={styles.batchActions}>
        {!viewBatch && (
          <Button variant="ghost" size="sm" onClick={onViewBatch} disabled={working}>
            <ListChecks /> Ver lote
          </Button>
        )}
        <Button size="sm" disabled={working || selected === 0} onClick={onConfirm}>
          <CheckCheck />{" "}
          {working
            ? "Confirmando…"
            : selected === 1
              ? "Confirmar 1 vínculo"
              : `Confirmar ${selected} vínculos`}
        </Button>
      </div>
    </footer>
  );
}
