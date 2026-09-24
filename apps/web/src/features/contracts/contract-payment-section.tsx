"use client";

import type { ReactElement } from "react";
import { FormSection } from "@lazuli/ui";
import { formatBRLFromCents } from "~/lib/format";
import type { FormProps } from "./contract-form-fields";
import { TextField } from "./contract-text-field";

const CENTS_PER_REAL = 100;

function civilDateBR(value: string | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function PaymentPreview({
  fields,
  preview,
}: Pick<FormProps, "fields" | "preview">): ReactElement | null {
  if (!preview) return null;
  const monthlyCents = fields.monthlyAmount
    ? Number(fields.monthlyAmount.replace(",", ".")) * CENTS_PER_REAL
    : 0;
  return (
    <div
      className="rounded-md border border-border bg-muted/30 p-3 text-caption"
      aria-live="polite"
    >
      <p>
        Vigência até {civilDateBR(preview.endsOn)} · principal{" "}
        {formatBRLFromCents(preview.principalAmountCents)}
      </p>
      <p>
        {preview.installments.length} cobranças mensais de {formatBRLFromCents(monthlyCents)} · em
        dia {formatBRLFromCents(preview.onTimeMonthlyCents)} · piso{" "}
        {formatBRLFromCents(preview.floorCents)}
      </p>
      <p>
        Primeiro vencimento {civilDateBR(preview.installments[0]?.dueDate)} · último{" "}
        {civilDateBR(preview.installments.at(-1)?.dueDate)}
      </p>
    </div>
  );
}

export function PaymentSection(props: FormProps): ReactElement {
  const { fields, errors, change, preview } = props;
  return (
    <FormSection title="Plano de pagamento">
      <TextField
        name="firstDueDate"
        label="Primeira cobrança"
        placeholder="dd/mm/aaaa"
        date
        value={fields.firstDueDate}
        onChange={(value) => change("firstDueDate", value)}
        error={errors.firstDueDate}
      />
      <PaymentPreview fields={fields} preview={preview} />
    </FormSection>
  );
}
