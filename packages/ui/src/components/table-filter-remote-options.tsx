"use client";

import { useState, type ReactElement } from "react";
import { Check } from "lucide-react";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import type { TableFilterField, TableFilterOption } from "./table-filter-model";

export function RemoteOptionsEditor({
  field,
}: {
  field: Extract<TableFilterField, { kind: "remote-options" }>;
}): ReactElement {
  const selected = new Set(field.selected);
  const query = field.search.trim();
  const result = field.result.query === query ? field.result : null;
  const visibleOptions = result?.status === "ready" ? result.options.slice(0, 20) : [];
  const toggle = (id: string): void => {
    field.onChange(
      selected.has(id) ? field.selected.filter((value) => value !== id) : [...field.selected, id],
    );
  };
  const optionRow = (option: TableFilterOption): ReactElement => (
    <li key={option.id}>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto min-h-control-sm w-full whitespace-normal px-2 py-1 text-left font-normal [&>span]:w-full [&>span]:justify-between"
        aria-pressed={selected.has(option.id)}
        onClick={() => toggle(option.id)}
      >
        <span className="min-w-0 flex-1 break-words">{option.label}</span>
        {selected.has(option.id) ? <Check aria-hidden="true" className="size-4" /> : null}
      </Button>
    </li>
  );
  return (
    <div className="space-y-2">
      <Input
        aria-label={`Buscar ${field.label}`}
        size="sm"
        type="search"
        value={field.search}
        onChange={(event) => field.onSearchChange(event.target.value)}
        placeholder={`Buscar ${field.label.toLocaleLowerCase("pt-BR")}`}
      />
      <div className="scrollbar-subtle max-h-52 overflow-y-auto pr-2">
        {query === "" ? (
          <p className="px-2 py-2 text-muted-foreground">Digite para buscar opções.</p>
        ) : result === null || result.status === "loading" || result.status === "idle" ? (
          <p className="px-2 py-2 text-muted-foreground" role="status">
            Buscando {field.label.toLocaleLowerCase("pt-BR")}...
          </p>
        ) : result.status === "error" ? (
          <div className="flex items-center justify-between gap-2 px-2 py-2">
            <p role="alert">Não foi possível buscar {field.label.toLocaleLowerCase("pt-BR")}.</p>
            <Button variant="ghost" size="sm" onClick={result.onRetry}>
              Tentar novamente
            </Button>
          </div>
        ) : visibleOptions.length === 0 ? (
          <p className="px-2 py-2 text-muted-foreground">Nenhuma opção encontrada</p>
        ) : (
          <ul>{visibleOptions.map(optionRow)}</ul>
        )}
      </div>
      {query !== "" &&
      result?.status === "ready" &&
      (result.hasMore || result.options.length > 20) ? (
        <p className="px-2 text-micro text-muted-foreground">
          Exibindo os primeiros 20. Refine a busca para encontrar outros.
        </p>
      ) : null}
    </div>
  );
}

export function OptionsEditor({
  field,
}: {
  field: Extract<TableFilterField, { kind: "options" }>;
}): ReactElement {
  const [search, setSearch] = useState("");
  return (
    <div className="space-y-2">
      {field.onSearch ? (
        <Input
          aria-label={`Buscar ${field.label}`}
          size="sm"
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            field.onSearch?.(event.target.value);
          }}
          placeholder="Buscar opção"
        />
      ) : null}
      <div className="scrollbar-subtle grid max-h-52 grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-1 overflow-y-auto pr-2">
        {field.options.map((option) => (
          <label
            key={option.id}
            className="flex min-w-0 cursor-pointer items-start gap-2 rounded-sm p-1.5 hover:bg-accent"
          >
            <Checkbox
              className="mt-0.5"
              checked={field.selected.includes(option.id)}
              onCheckedChange={(checked) =>
                field.onChange(
                  checked
                    ? [...field.selected, option.id]
                    : field.selected.filter((id) => id !== option.id),
                )
              }
            />
            <span className="min-w-0 break-words">{option.label}</span>
          </label>
        ))}
        {field.options.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma opção encontrada</p>
        ) : null}
      </div>
    </div>
  );
}
