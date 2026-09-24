"use client";

import { useDeferredValue, useState, type ReactElement } from "react";

import { Button, Field, FieldError, Input, Label } from "@lazuli/ui";

import { trpc } from "~/lib/trpc";

export function PartyPicker({
  kind,
  value,
  onChange,
  error,
}: {
  kind: "student" | "payer";
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}): ReactElement {
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const deferred = useDeferredValue(search);
  const results = trpc.finance.searchContractParties.useQuery({ query: deferred });
  const options = kind === "student" ? results.data?.students : results.data?.payers;
  const label = kind === "student" ? "Aluno" : "Pagador";
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
        <div
          className="max-h-32 overflow-y-auto rounded-md border border-border bg-card p-1"
          role="group"
          aria-label={`Resultados de ${label.toLowerCase()}`}
        >
          {results.isPending && <p className="p-2 text-caption">Buscando…</p>}
          {results.isError && (
            <p className="p-2 text-caption text-destructive">Busca indisponível.</p>
          )}
          {options?.length === 0 && <p className="p-2 text-caption">Nenhum resultado.</p>}
          {options?.map((option) => (
            <Button
              className="w-full justify-start"
              key={option.id}
              onClick={() => {
                onChange(option.id);
                setSelectedName(option.name);
                setSearch("");
              }}
              type="button"
              variant="ghost"
            >
              {option.name}
            </Button>
          ))}
        </div>
      )}
      <FieldError match={Boolean(error)}>{error}</FieldError>
    </Field>
  );
}
