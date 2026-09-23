"use client";

import type { ReactElement } from "react";
import { CurrencyInput } from "./currency-input";
import { Input } from "./input";
import { Switch } from "./switch";
import { OptionsEditor, RemoteOptionsEditor } from "./table-filter-remote-options";

const CENTS_PER_REAL = 100;
type RangeField = Extract<TableFilterField, { kind: "period" | "amount" }>;
import type { TableFilterField } from "./table-filter-model";

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

export function FieldEditor({ field }: { field: TableFilterField }): ReactElement {
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
