"use client";

import { useState, type ReactElement } from "react";
import {
  CalendarDays,
  Check,
  CircleDollarSign,
  ListFilter,
  SlidersHorizontal,
  ToggleRight,
  X,
} from "lucide-react";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { CurrencyInput } from "./currency-input";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "./popover";
import { Switch } from "./switch";
import { summary, type TableFilterField, type TableFilterOption } from "./table-filter-model";

const VISIBLE_LIMIT = 20;
const CENTS_PER_REAL = 100;
type RemoteField = Extract<TableFilterField, { kind: "remote-options" }>;
type RangeField = Extract<TableFilterField, { kind: "period" | "amount" }>;

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

function RemoteOptionsEditor({ field }: { field: RemoteField }): ReactElement {
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
        maxLength={field.searchMaxLength}
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

function OptionsEditor({
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

function amountToCents(value: string): number | null {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/u.exec(value);
  if (!match) return null;
  const cents = Number(match[1]) * CENTS_PER_REAL + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

function centsToAmount(cents: number | null): string {
  if (cents === null) return "";
  return `${Math.floor(cents / CENTS_PER_REAL)}.${String(cents % CENTS_PER_REAL).padStart(2, "0")}`;
}

function RangeEditor({ field }: { field: RangeField }): ReactElement {
  const period = field.kind === "period";
  return (
    <div className="grid grid-cols-1 gap-2 min-[320px]:grid-cols-2">
      <label className="space-y-1">
        {period ? "De" : "Mínimo"}
        {period ? (
          <Input
            aria-label={`${field.label}: início`}
            size="sm"
            type="date"
            max={field.to || undefined}
            value={field.from}
            onChange={(event) => field.onChange(event.target.value, field.to)}
          />
        ) : (
          <CurrencyInput
            aria-label={`${field.label}: início`}
            size="sm"
            value={amountToCents(field.from)}
            onValueChange={(cents) => field.onChange(centsToAmount(cents), field.to)}
          />
        )}
      </label>
      <label className="space-y-1">
        {period ? "Até" : "Máximo"}
        {period ? (
          <Input
            aria-label={`${field.label}: fim`}
            size="sm"
            type="date"
            min={field.from || undefined}
            value={field.to}
            onChange={(event) => field.onChange(field.from, event.target.value)}
          />
        ) : (
          <CurrencyInput
            aria-label={`${field.label}: fim`}
            size="sm"
            value={amountToCents(field.to)}
            onValueChange={(cents) => field.onChange(field.from, centsToAmount(cents))}
          />
        )}
      </label>
    </div>
  );
}

function FieldEditor({ field }: { field: TableFilterField }): ReactElement {
  if (field.kind === "options") return <OptionsEditor field={field} />;
  if (field.kind === "remote-options") return <RemoteOptionsEditor field={field} />;
  if (field.kind === "toggle") {
    return (
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-sm py-1.5">
        <span>{field.label}</span>
        <Switch checked={field.checked} onCheckedChange={field.onChange} />
      </label>
    );
  }
  return <RangeEditor field={field} />;
}

export function FilterIcon({ field }: { field: TableFilterField }): ReactElement {
  const Icon =
    field.icon ??
    {
      options: ListFilter,
      "remote-options": ListFilter,
      period: CalendarDays,
      amount: CircleDollarSign,
      toggle: ToggleRight,
    }[field.kind];
  return <Icon aria-hidden="true" className="size-4 shrink-0" />;
}

function ClearFieldButton({ field }: { field: TableFilterField }): ReactElement {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Limpar ${field.label}`}
      onClick={field.onClear}
    >
      <X aria-hidden="true" />
    </Button>
  );
}

export function InlineField({ field }: { field: TableFilterField }): ReactElement {
  if (field.kind === "toggle") {
    return (
      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5">
        <FilterIcon field={field} />
        <span>{field.label}</span>
        <Switch checked={field.checked} onCheckedChange={field.onChange} />
      </label>
    );
  }
  const active = summary(field);
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="secondary"
            size="sm"
            aria-label={`${field.label}${active ? `: ${active}` : ""}`}
          />
        }
      >
        <FilterIcon field={field} />
        {field.label}
        {active
          ? ` · ${field.kind === "options" || field.kind === "remote-options" ? field.selected.length : "1"}`
          : ""}
      </PopoverTrigger>
      <PopoverContent
        className="max-w-[calc(100vw-2rem)]"
        size={field.kind === "options" ? "sm" : "md"}
        align="start"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <PopoverTitle>{field.label}</PopoverTitle>
          {active ? <ClearFieldButton field={field} /> : null}
        </div>
        <FieldEditor field={field} />
      </PopoverContent>
    </Popover>
  );
}

function SecondaryFieldSection({ field }: { field: TableFilterField }): ReactElement {
  return (
    <section className="space-y-2 border-b border-border pb-3 last:border-0">
      {field.kind === "toggle" ? (
        <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5">
          <span className="flex items-center gap-2 font-semibold">
            <FilterIcon field={field} />
            {field.label}
          </span>
          <Switch checked={field.checked} onCheckedChange={field.onChange} />
        </label>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <FilterIcon field={field} />
              {field.label}
            </h2>
            {summary(field) ? <ClearFieldButton field={field} /> : null}
          </div>
          <FieldEditor field={field} />
        </>
      )}
    </section>
  );
}

export function MoreFilters({
  fields,
  activeCount,
}: {
  fields: TableFilterField[];
  activeCount: number;
}): ReactElement {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="secondary"
            size="sm"
            className="max-w-full rounded-r-none border-r-0 px-1.5"
            aria-label={`Mais filtros${activeCount > 0 ? `, ${activeCount} ativos` : ""}`}
          />
        }
      >
        <SlidersHorizontal aria-hidden="true" className="size-4" /> Mais filtros
        {activeCount > 0 ? (
          <span className="hidden min-[320px]:inline">· {activeCount}</span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        aria-label="Mais filtros"
        className="w-[min(24rem,calc(100vw-2rem))] p-2"
        align="end"
      >
        <div className="scrollbar-subtle max-h-[min(70vh,calc(var(--available-height)-2.5rem))] space-y-4 overflow-y-auto p-2 pr-3">
          {fields.map((field) => (
            <SecondaryFieldSection key={field.id} field={field} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
