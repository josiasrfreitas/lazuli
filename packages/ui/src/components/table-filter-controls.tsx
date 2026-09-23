"use client";

import type { ReactElement } from "react";
import {
  CalendarDays,
  CircleDollarSign,
  ListFilter,
  SlidersHorizontal,
  ToggleRight,
  X,
} from "lucide-react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "./popover";
import { Switch } from "./switch";
import { FieldEditor } from "./table-filter-range";
import { summary, type TableFilterField } from "./table-filter-model";

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
          {active ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Limpar ${field.label}`}
              onClick={field.onClear}
            >
              <X aria-hidden="true" />
            </Button>
          ) : null}
        </div>
        <FieldEditor field={field} />
      </PopoverContent>
    </Popover>
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
            <section key={field.id} className="space-y-2 border-b border-border pb-3 last:border-0">
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
                    {summary(field) ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Limpar ${field.label}`}
                        onClick={field.onClear}
                      >
                        <X aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                  <FieldEditor field={field} />
                </>
              )}
            </section>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
