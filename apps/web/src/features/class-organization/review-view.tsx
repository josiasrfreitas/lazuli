import type { JSX as ReactJSX } from "react";
import { Button, Checkbox } from "@lazuli/ui";
import type { OrganizationAction, Placement, OrganizationBoard } from "./model";
import { ReviewRow } from "./review-row";
import styles from "./organization.module.css";

type ReviewProps = {
  board: OrganizationBoard;
  rows: Placement[];
  eligible: Placement[];
  selected: Placement[];
  ids: string[];
  showAll: boolean;
  working: boolean;
  error: string | null;
  onShowAll: (value: boolean) => void;
  onIds: (ids: string[]) => void;
  onSelection: (row: Placement, value: boolean) => void;
  onAction: (action: OrganizationAction) => void;
  onConfirm: () => void;
};

export function ReviewView(props: ReviewProps): ReactJSX.Element {
  return (
    <section className={styles.review} aria-label="Revisão das mudanças">
      <ReviewHeader showAll={props.showAll} onShowAll={props.onShowAll} />
      {props.error && (
        <div role="alert" className={styles.error}>
          {props.error}
        </div>
      )}
      <ReviewTable {...props} />
      <ReviewFooter {...props} />
    </section>
  );
}

function ReviewHeader({
  showAll,
  onShowAll,
}: Pick<ReviewProps, "showAll" | "onShowAll">): ReactJSX.Element {
  return (
    <div className={styles.row}>
      <div>
        <h2 className="text-body font-semibold">Antes de aplicar as alocações</h2>
        <p className={styles.small}>
          Compare origem e destino. Passe sobre a mudança ou abra os detalhes.
        </p>
      </div>
      <label className={styles.rowStart}>
        <Checkbox
          size="sm"
          checked={showAll}
          onCheckedChange={(value) => onShowAll(Boolean(value))}
        />
        <span className={styles.small}>Incluir já alocados</span>
      </label>
    </div>
  );
}

function ReviewTable({
  board,
  rows,
  eligible,
  selected,
  ids,
  working,
  onIds,
  onSelection,
  onAction,
}: ReviewProps): ReactJSX.Element {
  return (
    <div className={styles.reviewTable}>
      <table className={styles.table}>
        <ReviewTableHead eligible={eligible} selected={selected} working={working} onIds={onIds} />
        <tbody>
          {rows.map((row) => (
            <ReviewRow
              key={row.id}
              row={row}
              board={board}
              selected={ids.includes(row.id)}
              eligible={eligible.some((item) => item.id === row.id)}
              working={working}
              onSelection={(value) => onSelection(row, value)}
              onAction={onAction}
            />
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className={styles.empty}>
          <h2>Nenhuma mudança nesta seleção</h2>
          <p>
            Inclua os já alocados para consultar a composição ou organize novos alunos pela agenda.
          </p>
        </div>
      )}
    </div>
  );
}

function ReviewTableHead({
  eligible,
  selected,
  working,
  onIds,
}: Pick<ReviewProps, "eligible" | "selected" | "working" | "onIds">): ReactJSX.Element {
  return (
    <thead>
      <tr>
        <th>
          <Checkbox
            size="sm"
            aria-label="Selecionar alocações prontas"
            disabled={eligible.length === 0 || working}
            checked={eligible.length > 0 && selected.length === eligible.length}
            indeterminate={selected.length > 0 && selected.length < eligible.length}
            onCheckedChange={(value) => onIds(value ? eligible.map((row) => row.id) : [])}
          />
        </th>
        <th>Aluno / mudança</th>
        <th>Origem</th>
        <th>Destino</th>
        <th>Vigência</th>
        <th>Pendências / contrato</th>
        <th>
          <span className="sr-only">Ações</span>
        </th>
      </tr>
    </thead>
  );
}

function ReviewFooter({ selected, eligible, working, onConfirm }: ReviewProps): ReactJSX.Element {
  return (
    <footer className={styles.selection}>
      <span className={styles.small}>
        {selected.length} selecionados · {eligible.length} prontos para aplicar
      </span>
      <span className={`${styles.small} ${styles.push}`}>
        Contratos são tratados separadamente.
      </span>
      <Button size="sm" disabled={selected.length === 0 || working} onClick={onConfirm}>
        {working
          ? "Aplicando alocações…"
          : `Aplicar${selected.length > 0 ? ` ${selected.length}` : " selecionados"}`}
      </Button>
    </footer>
  );
}
