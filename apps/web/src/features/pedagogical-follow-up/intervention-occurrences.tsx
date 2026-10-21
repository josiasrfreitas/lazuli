"use client";

import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { Checkbox, Field, FieldError, FormSection, Input } from "@lazuli/ui";
import { Search } from "lucide-react";
import { CATEGORY, dateLabel, type OccurrenceRow } from "./shared";
import { DeskRowsLoading } from "./student-desk-loading";
import styles from "./intervention-form.module.css";

export function MotivatingOccurrenceFields({
  rows,
  ids,
  error,
  onChange,
  loading = false,
}: {
  rows: OccurrenceRow[];
  loading?: boolean;
  ids: string[];
  error?: string | undefined;
  onChange: (ids: string[]) => void;
}): ReactElement {
  const prefix = useId();
  const list = useRef<HTMLDivElement>(null);
  const revealInitialSelection = useRef(ids.length > 0);
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (loading || !revealInitialSelection.current || !list.current) return;
    const selected = list.current.querySelector<HTMLElement>('[data-selected="true"]');
    if (selected) {
      list.current.scrollTop +=
        selected.getBoundingClientRect().top - list.current.getBoundingClientRect().top;
    }
    revealInitialSelection.current = false;
  }, [loading, rows]);
  const query = normalize(search.trim());
  const filtered = rows.filter((row) =>
    normalize(
      [
        row.title,
        row.account,
        row.classSession.class.portalClassName,
        row.recordedBy.name,
        CATEGORY[row.category],
      ].join(" "),
    ).includes(query),
  );

  return (
    <FormSection
      title={
        <span id={`${prefix}-search-label`} className="inline-flex items-center gap-2">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span>
            Buscar ocorrências motivadoras{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </span>
        </span>
      }
    >
      {rows.length > 0 && (
        <Field>
          <Input
            id={`${prefix}-search`}
            aria-labelledby={`${prefix}-search-label`}
            name="occurrence-search"
            size="sm"
            autoComplete="off"
            placeholder="Busque por assunto, turma ou professor"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
          />
        </Field>
      )}
      <p className="sr-only" role="status">
        {ids.length > 0
          ? `${ids.length} ${ids.length === 1 ? "ocorrência selecionada" : "ocorrências selecionadas"}`
          : "Sem vínculo com ocorrências"}
      </p>
      <Field name="occurrenceIds">
        <div
          ref={list}
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
              <article
                key={row.id}
                className={styles.occurrence}
                data-selected={ids.includes(row.id)}
              >
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
                        {dateLabel(row.classSession.date)} ·{" "}
                        {row.classSession.class.portalClassName}
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
    </FormSection>
  );
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}
