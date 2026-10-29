"use client";
import { useRef, type ReactElement } from "react";
import { Button, CurrencyInput, Field, FieldError, Label } from "@lazuli/ui";
import { Pencil } from "lucide-react";
import { formatBRLFromCents as money } from "~/lib/format";
import type { FormProps } from "./contract-form-fields";

export function MaterialAgreedPrice({
  fields,
  change,
  error,
  referenceCents,
}: Pick<FormProps, "fields" | "change"> & {
  error: string | undefined;
  referenceCents: number;
}): ReactElement {
  const input = useRef<HTMLInputElement>(null);
  const custom = fields.materialPriceMode === "CUSTOM";
  const cents = fields.materialCustomPrice.trim()
    ? Math.round(Number(fields.materialCustomPrice.replace(",", ".")) * 100)
    : null;
  function edit(): void {
    change("materialCustomPrice", (referenceCents / 100).toFixed(2).replace(".", ","));
    change("materialPriceMode", "CUSTOM");
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.select();
    });
  }
  return (
    <Field name="materialCustomPrice" className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <Label>
          {fields.materialScholarshipMode === "NONE"
            ? "Total desta aquisição"
            : "Valor antes da bolsa"}
        </Label>
        {custom ? (
          <CurrencyInput
            ref={input}
            name="materialCustomPrice"
            size="sm"
            className="w-36 font-numeric text-right"
            placeholder="R$ 0,00"
            autoComplete="off"
            value={cents !== null && Number.isSafeInteger(cents) ? cents : null}
            invalid={Boolean(error)}
            onValueChange={(value) =>
              change("materialCustomPrice", value === null ? "" : (value / 100).toFixed(2))
            }
          />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="font-numeric text-lg"
            aria-label={`Editar valor do material: ${money(referenceCents)}`}
            onClick={edit}
          >
            {money(referenceCents)} <Pencil className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
      {custom && (
        <div className="flex items-center justify-between gap-2 text-caption text-muted-foreground">
          <span>Sugestão dos Ajustes: {money(referenceCents)}</span>
          <Button
            type="button"
            variant="text"
            size="inline"
            onClick={() => change("materialPriceMode", "REFERENCE")}
          >
            Usar sugestão
          </Button>
        </div>
      )}
      {error && <FieldError match>{error}</FieldError>}
    </Field>
  );
}
