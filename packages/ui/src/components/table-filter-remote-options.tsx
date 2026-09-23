"use client";

import { useState, type ReactElement } from "react";
import { Check } from "lucide-react";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import type { TableFilterField, TableFilterOption } from "./table-filter-model";

const VISIBLE_LIMIT = 20;
type RemoteField = Extract<TableFilterField, { kind: "remote-options" }>;

function RemoteOptionRow({
  option,
  field,
}: {
  option: TableFilterOption;
  field: RemoteField;
}): ReactElement {
  const selected = field.selected.includes(option.id);
  return (
    <li>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto min-h-control-sm w-full whitespace-normal px-2 py-1 text-left font-normal [&>span]:w-full [&>span]:justify-between"
        aria-pressed={selected}
        onClick={() =>
          field.onChange(
            selected
              ? field.selected.filter((id) => id !== option.id)
              : [...field.selected, option.id],
          )
        }
      >
        <span className="min-w-0 flex-1 break-words">{option.label}</span>
        {selected ? <Check aria-hidden="true" className="size-4" /> : null}
      </Button>
    </li>
  );
}

function RemoteOptionsResults({
  field,
  query,
}: {
  field: RemoteField;
  query: string;
}): ReactElement {
  const result = field.result.query === query ? field.result : null;
  if (query === "")
    return <p className="px-2 py-2 text-muted-foreground">Digite para buscar opções.</p>;
  if (!result || result.status === "loading" || result.status === "idle") {
    return (
      <p className="px-2 py-2 text-muted-foreground" role="status">
        Buscando {field.label.toLocaleLowerCase("pt-BR")}...
      </p>
    );
  }
  if (result.status === "error") {
    return (
      <div className="flex items-center justify-between gap-2 px-2 py-2">
        <p role="alert">Não foi possível buscar {field.label.toLocaleLowerCase("pt-BR")}.</p>
        <Button variant="ghost" size="sm" onClick={result.onRetry}>
          Tentar novamente
        </Button>
      </div>
    );
  }
  const options = result.options.slice(0, VISIBLE_LIMIT);
  if (options.length === 0)
    return <p className="px-2 py-2 text-muted-foreground">Nenhuma opção encontrada</p>;
  return (
    <ul>
      {options.map((option) => (
        <RemoteOptionRow key={option.id} option={option} field={field} />
      ))}
    </ul>
  );
}

export function RemoteOptionsEditor({ field }: { field: RemoteField }): ReactElement {
  const query = field.search.trim();
  const result = field.result.query === query ? field.result : null;
  const hasMore =
    result?.status === "ready" && (result.hasMore || result.options.length > VISIBLE_LIMIT);
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
        <RemoteOptionsResults field={field} query={query} />
      </div>
      {query && hasMore ? (
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
