"use client";

import type { ReactElement } from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { InlineField, MoreFilters } from "./table-filter-controls";
import { summary, type TableFilterField } from "./table-filter-model";

export type {
  TableFilterField,
  TableFilterOption,
  RemoteOptionsResult,
} from "./table-filter-model";
export { TableFilterChips } from "./table-filter-chips";

type TableFiltersProps = {
  fields: TableFilterField[];
  onClearAll: () => void;
};

/** Controlled composition: each listing owns URL state and supplies its field configuration. */
export function TableFilters({ fields, onClearAll }: TableFiltersProps): ReactElement {
  const active = fields.filter((field) => summary(field));
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
        <div className="inline-flex max-w-full items-center">
          {secondary.length > 0 ? (
            <MoreFilters fields={secondary} activeCount={activeSecondaryCount} />
          ) : null}
          <Tooltip>
            <TooltipTrigger
              aria-label="Limpar todos os filtros"
              render={
                <Button
                  variant="secondary"
                  size="icon-sm"
                  className="rounded-l-none text-muted-foreground hover:bg-accent-hover hover:text-destructive"
                  disabled={active.length === 0}
                  onClick={onClearAll}
                >
                  <X aria-hidden="true" />
                </Button>
              }
            />
            <TooltipContent>Limpar todos os filtros</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
