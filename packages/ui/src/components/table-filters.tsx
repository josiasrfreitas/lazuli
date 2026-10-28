"use client";

import { type ReactElement } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "./button";
import { TableFilterLabel } from "./table-filter-label";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { InlineField, MoreFilters } from "./table-filter-controls";
import { summary, type TableFilterField } from "./table-filter-model";

export type {
  TableFilterField,
  TableFilterOption,
  RemoteOptionsResult,
} from "./table-filter-model";

function chipLabel(field: TableFilterField): string {
  if (field.kind === "toggle") return field.label;
  if ((field.kind === "options" || field.kind === "remote-options") && field.selected.length > 2) {
    return `${field.label} (${field.selected.length})`;
  }
  return `${field.label}: ${summary(field)}`;
}

type SelectedField = Extract<TableFilterField, { kind: "options" | "remote-options" }>;

function SelectedOptionRow({
  field,
  id,
  label,
}: {
  field: SelectedField;
  id: string;
  label: string;
}): ReactElement {
  return (
    <li className="flex min-h-control-sm min-w-0 items-center justify-between gap-2 px-2">
      <span className="min-w-0 break-words py-1">{label}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remover ${label} de ${field.label}`}
        onClick={() => field.onChange(field.selected.filter((value) => value !== id))}
      >
        <X aria-hidden="true" />
      </Button>
    </li>
  );
}

function SelectedChipMenu({ field, label }: { field: SelectedField; label: string }): ReactElement {
  const available = field.kind === "options" ? field.options : field.selectedOptions;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="min-w-0 flex-1 justify-start rounded-r-none px-2 font-normal text-foreground [&>span]:w-full"
            aria-label={`Gerenciar ${label}`}
          />
        }
      >
        <TableFilterLabel label={label} />
        <ChevronDown aria-hidden="true" className="size-3 shrink-0" />
      </PopoverTrigger>
      <PopoverContent
        aria-label={`Opções selecionadas de ${field.label}`}
        align="start"
        className="w-[min(18rem,calc(100vw-2rem))] p-2"
      >
        <ul className="scrollbar-subtle max-h-52 divide-y divide-border overflow-y-auto pr-2">
          {field.selected.map((id) => {
            const optionLabel =
              available.find((option) => option.id === id)?.label ?? "Seleção indisponível";
            return <SelectedOptionRow key={id} field={field} id={id} label={optionLabel} />;
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function ActiveChip({ field }: { field: TableFilterField }): ReactElement {
  const label = chipLabel(field);
  return (
    <div
      className="flex min-h-control-sm w-full min-w-0 items-center overflow-hidden rounded-sm border border-border bg-background text-foreground"
      data-slot="table-filter-chip"
    >
      {field.kind === "options" || field.kind === "remote-options" ? (
        <SelectedChipMenu field={field} label={label} />
      ) : (
        <span className="flex min-w-0 flex-1 px-2 text-control">
          <TableFilterLabel label={label} />
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0 rounded-l-none border-l border-border text-foreground hover:bg-accent"
        onClick={field.onClear}
        aria-label={`Remover filtro ${field.label}`}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Compact disclosure; its panel never takes space away from the results. */
export function TableFilterChips({
  fields,
  onClearAll,
}: {
  fields: TableFilterField[];
  onClearAll?: () => void;
}): ReactElement | null {
  const active = fields.filter((field) => summary(field));
  if (active.length === 0) return null;
  return (
    <div className="inline-flex max-w-full items-center" data-slot="table-active-filters">
      <Popover>
        <PopoverTrigger
          openOnHover
          delay={150}
          closeDelay={200}
          render={<Button variant="secondary" size="sm" className="rounded-r-none" />}
        >
          Filtros ativos · {active.length}
          <ChevronDown aria-hidden="true" className="size-3" />
        </PopoverTrigger>
        <PopoverContent
          aria-label="Filtros ativos"
          align="end"
          motion="unfold"
          className="w-[min(18rem,calc(100vw-2rem))] p-2"
        >
          <div className="scrollbar-subtle flex max-h-[min(60vh,var(--available-height))] flex-col gap-1.5 overflow-y-auto">
            {active.map((field) => (
              <ActiveChip key={field.id} field={field} />
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="secondary"
              size="icon-sm"
              className="rounded-l-none border-l-0 text-muted-foreground hover:text-destructive"
              aria-label="Limpar todos os filtros"
              onClick={
                onClearAll ??
                (() => {
                  for (const field of active) field.onClear();
                })
              }
            >
              <X aria-hidden="true" />
            </Button>
          }
        />
        <TooltipContent>Limpar todos os filtros</TooltipContent>
      </Tooltip>
    </div>
  );
}

type TableFiltersProps = {
  fields: TableFilterField[];
  onClearAll: () => void;
};

/** Controlled composition: each listing owns URL state and supplies its field configuration. */
export function TableFilters({ fields, onClearAll }: TableFiltersProps): ReactElement {
  const secondary = fields.filter((field) => !field.promoted);
  const activeSecondaryCount = secondary.filter((field) => summary(field)).length;
  return (
    <div className="min-w-0 max-w-full space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {fields
          .filter((field) => field.promoted)
          .map((field) => (
            <InlineField key={field.id} field={field} />
          ))}
        {secondary.length > 0 && (
          <MoreFilters fields={secondary} activeCount={activeSecondaryCount} />
        )}
        <TableFilterChips fields={fields} onClearAll={onClearAll} />
      </div>
    </div>
  );
}
