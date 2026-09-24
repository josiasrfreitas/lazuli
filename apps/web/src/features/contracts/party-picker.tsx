"use client";

import { useDeferredValue, useState, type ReactElement } from "react";

import { Button, Field, FieldError, Input, Label } from "@lazuli/ui";

import { trpc } from "~/lib/trpc";

type Option = { id: string; name: string; detail?: string };
type PartyPickerProps = {
  kind: "student" | "payer";
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
};

function PartyResults({
  label,
  options,
  pending,
  failed,
  onSelect,
}: {
  label: string;
  options: Option[] | undefined;
  pending: boolean;
  failed: boolean;
  onSelect: (option: Option) => void;
}): ReactElement {
  return (
    <div
      className="max-h-32 overflow-y-auto rounded-md border border-border bg-card p-1"
      role="group"
      aria-label={`Resultados de ${label.toLowerCase()}`}
    >
      {pending && <p className="p-2 text-caption">Buscando…</p>}
      {failed && <p className="p-2 text-caption text-destructive">Busca indisponível.</p>}
      {options?.length === 0 && <p className="p-2 text-caption">Nenhum resultado.</p>}
      {options?.map((option) => (
        <div key={option.id}>
          <Button
            className="w-full justify-start"
            aria-describedby={option.detail ? `party-${option.id}-detail` : undefined}
            onClick={() => onSelect(option)}
            type="button"
            variant="ghost"
          >
            {option.name}
          </Button>
          {option.detail && (
            <p
              id={`party-${option.id}-detail`}
              className="truncate text-caption text-muted-foreground"
            >
              {option.detail}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function PartyPicker({ kind, value, onChange, error }: PartyPickerProps): ReactElement {
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const deferred = useDeferredValue(search);
  const results = trpc.finance.searchContractParties.useQuery({ query: deferred });
  const options = kind === "student" ? results.data?.students : results.data?.payers;
  const label = kind === "student" ? "Aluno" : "Pagador";
  const select = (option: Option): void => {
    onChange(option.id);
    setSelectedName(option.detail ? `${option.name} · ${option.detail}` : option.name);
    setSearch("");
  };
  return (
    <Field name={`${kind}Search`}>
      <Label>{label}</Label>
      <Input
        autoComplete="off"
        name={`${kind}Search`}
        invalid={Boolean(error)}
        onChange={(event) => {
          setSearch(event.target.value);
          setSelectedName("");
          onChange("");
        }}
        placeholder={`Buscar ${label.toLowerCase()} por nome`}
        size="sm"
        value={selectedName || search}
      />
      {!value && search && (
        <PartyResults
          label={label}
          options={options}
          pending={results.isPending}
          failed={results.isError}
          onSelect={select}
        />
      )}
      <FieldError match={Boolean(error)}>{error}</FieldError>
    </Field>
  );
}
