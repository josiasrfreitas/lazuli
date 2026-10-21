"use client";
import type { JSX as ReactJSX } from "react";
import { useState, type ReactNode } from "react";
import { normalizeSearch } from "@lazuli/domain";
import { Field, FieldError, Label, SearchSelect } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";

export function IntakeStageSelect({
  value,
  onChange,
  initialOnly = false,
  disabled = false,
  error,
  labelIcon,
  openOnFocus = true,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  initialOnly?: boolean;
  disabled?: boolean;
  error?: string | undefined;
  labelIcon?: ReactNode;
  openOnFocus?: boolean;
}): ReactJSX.Element {
  const stages = trpc.admissions.stages.useQuery();
  const [query, setQuery] = useState("");
  const selected = stages.data?.find((row) => row.id === value);
  return (
    <Field>
      <Label>
        <span className="inline-flex items-center gap-1.5">
          {labelIcon}
          {initialOnly ? "Estágio inicial" : "Estágio indicado"}
        </span>
      </Label>
      <SearchSelect
        name="stageId"
        placeholder="Buscar estágio"
        query={query}
        value={selected ? { id: selected.id, label: `${selected.track} · ${selected.name}` } : null}
        options={(stages.data ?? [])
          .filter(
            (row) =>
              (!initialOnly || row.initial) &&
              normalizeSearch(`${row.track} ${row.name}`).includes(normalizeSearch(query)),
          )
          .map((row) => ({ id: row.id, label: row.name, description: row.track }))}
        loading={stages.isPending}
        failed={stages.isError}
        disabled={disabled}
        onQueryChange={setQuery}
        onSelect={(row) => {
          onChange(row.id);
          setQuery("");
        }}
        onClear={() => onChange(null)}
        openOnFocus={openOnFocus}
        invalid={Boolean(error)}
        emptyMessage="Nenhum estágio encontrado."
      />
      {error && <FieldError match>{error}</FieldError>}
    </Field>
  );
}
