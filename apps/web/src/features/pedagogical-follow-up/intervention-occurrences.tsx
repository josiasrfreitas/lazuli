"use client";

import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { Field, FormSection, Input } from "@lazuli/ui";
import { Search } from "lucide-react";
import { CATEGORY, type OccurrenceRow } from "./shared";
import { OccurrenceResults } from "./intervention-occurrence-results";

type Props = {
  rows: OccurrenceRow[];
  loading?: boolean;
  ids: string[];
  error?: string | undefined;
  onChange: (ids: string[]) => void;
};

export function MotivatingOccurrenceFields({
  rows,
  ids,
  error,
  onChange,
  loading = false,
}: Props): ReactElement {
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
  const filtered = filterOccurrences(rows, search);
  return (
    <FormSection title={<SearchLabel prefix={prefix} />}>
      {rows.length > 0 && <OccurrenceSearch prefix={prefix} search={search} onChange={setSearch} />}
      <p className="sr-only" role="status">
        {ids.length > 0
          ? `${ids.length} ${ids.length === 1 ? "ocorrência selecionada" : "ocorrências selecionadas"}`
          : "Sem vínculo com ocorrências"}
      </p>
      <OccurrenceResults
        rows={rows}
        filtered={filtered}
        ids={ids}
        error={error}
        loading={loading}
        prefix={prefix}
        listRef={list}
        onChange={onChange}
      />
    </FormSection>
  );
}

function SearchLabel({ prefix }: { prefix: string }): ReactElement {
  return (
    <span id={`${prefix}-search-label`} className="inline-flex items-center gap-2">
      <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span>
        Buscar ocorrências motivadoras{" "}
        <span className="font-normal text-muted-foreground">(opcional)</span>
      </span>
    </span>
  );
}

function OccurrenceSearch({
  prefix,
  search,
  onChange,
}: {
  prefix: string;
  search: string;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <Field>
      <Input
        id={`${prefix}-search`}
        aria-labelledby={`${prefix}-search-label`}
        name="occurrence-search"
        size="sm"
        autoComplete="off"
        placeholder="Busque por assunto, turma ou professor"
        value={search}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
      />
    </Field>
  );
}

function filterOccurrences(rows: OccurrenceRow[], search: string): OccurrenceRow[] {
  const query = normalize(search.trim());
  return rows.filter((row) =>
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
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}
