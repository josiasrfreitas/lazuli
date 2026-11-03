"use client";
import { useRef, type ReactElement, type RefObject } from "react";
import { Button, CurrencyInput, Field, FieldError, Label } from "@lazuli/ui";
import { Pencil } from "lucide-react";
import { formatBRLFromCents as money } from "~/lib/format";
import type { FormProps } from "./contract-form-fields";

const CENTS_PER_REAL = 100;
type MaterialPriceProps = Pick<FormProps, "fields" | "change"> & {
  error: string | undefined;
  referenceCents: number;
};

export function MaterialAgreedPrice({
  fields,
  change,
  error,
  referenceCents,
}: MaterialPriceProps): ReactElement {
  const input = useRef<HTMLInputElement>(null);
  const custom = fields.materialPriceMode === "CUSTOM";
  const cents = fields.materialCustomPrice.trim()
    ? Math.round(Number(fields.materialCustomPrice.replace(",", ".")) * CENTS_PER_REAL)
    : null;
  function edit(): void {
    change("materialCustomPrice", (referenceCents / CENTS_PER_REAL).toFixed(2).replace(".", ","));
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
          <CustomPriceInput {...{ input, cents, error, change }} />
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
      {custom && <MaterialPriceSuggestion referenceCents={referenceCents} change={change} />}
      {error && <FieldError match>{error}</FieldError>}
    </Field>
  );
}

function CustomPriceInput({
  input,
  cents,
  error,
  change,
}: Pick<MaterialPriceProps, "error" | "change"> & {
  input: RefObject<HTMLInputElement | null>;
  cents: number | null;
}): ReactElement {
  return (
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
        change("materialCustomPrice", value === null ? "" : (value / CENTS_PER_REAL).toFixed(2))
      }
    />
  );
}

function MaterialPriceSuggestion({
  referenceCents,
  change,
}: Pick<MaterialPriceProps, "referenceCents" | "change">): ReactElement {
  return (
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
  );
}
