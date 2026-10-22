import type { ReactElement, Ref } from "react";
import { Checkbox, Field, FieldError } from "@lazuli/ui";
import { CATEGORY, dateLabel, type OccurrenceRow } from "./shared";
import { DeskRowsLoading } from "./student-desk-loading";
import styles from "./intervention-form.module.css";

type Props = {
  rows: OccurrenceRow[];
  filtered: OccurrenceRow[];
  ids: string[];
  error?: string | undefined;
  loading: boolean;
  prefix: string;
  listRef: Ref<HTMLDivElement>;
  onChange: (ids: string[]) => void;
};

export function OccurrenceResults({
  rows,
  filtered,
  ids,
  error,
  loading,
  prefix,
  listRef,
  onChange,
}: Props): ReactElement {
  return (
    <Field name="occurrenceIds">
      <div
        ref={listRef}
        className={styles.occurrences}
        role="group"
        aria-label="Ocorrências motivadoras"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${prefix}-error` : undefined}
        aria-busy={loading}
        tabIndex={0}
      >
        {loading ? (
          <DeskRowsLoading />
        ) : (
          filtered.map((row) => (
            <OccurrenceChoice
              key={row.id}
              row={row}
              ids={ids}
              prefix={prefix}
              onChange={onChange}
            />
          ))
        )}
        {!loading && filtered.length === 0 && (
          <p className={styles.empty}>
            {rows.length === 0
              ? "Nenhuma ocorrência registrada. Você pode registrar a intervenção sem vínculo."
              : "Nenhuma ocorrência corresponde à busca. As seleções foram mantidas."}
          </p>
        )}
      </div>
      <FieldError id={`${prefix}-error`} match={Boolean(error)}>
        {error}
      </FieldError>
    </Field>
  );
}

function OccurrenceChoice({
  row,
  ids,
  prefix,
  onChange,
}: {
  row: OccurrenceRow;
  ids: string[];
  prefix: string;
  onChange: (ids: string[]) => void;
}): ReactElement {
  return (
    <article className={styles.occurrence} data-selected={ids.includes(row.id)}>
      <label className={styles.choice} htmlFor={`${prefix}-${row.id}`}>
        <Checkbox
          id={`${prefix}-${row.id}`}
          name="occurrenceIds"
          value={row.id}
          checked={ids.includes(row.id)}
          onCheckedChange={(checked) =>
            onChange(checked ? [...ids, row.id] : ids.filter((id) => id !== row.id))
          }
        />
        <span className={styles.choiceText}>
          <strong>{row.title}</strong>
          <span className={styles.metadata}>
            <span>
              {dateLabel(row.classSession.date)} · {row.classSession.class.portalClassName}
            </span>
            <span>
              {CATEGORY[row.category]} · {row.recordedBy.name}
            </span>
          </span>
        </span>
      </label>
      <details className={styles.account}>
        <summary>Ler relato</summary>
        <p>{row.account}</p>
        {row.initialResponse && (
          <div>
            <strong>Ação imediata</strong>
            <p>{row.initialResponse}</p>
          </div>
        )}
      </details>
    </article>
  );
}
