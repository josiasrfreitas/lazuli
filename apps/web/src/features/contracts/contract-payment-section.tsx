"use client";

import { useId, useState, type ReactElement } from "react";
import { Button, Field, FieldError, FormSection, Input, Label } from "@lazuli/ui";
import { formatBRLFromCents } from "~/lib/format";
import type { FormProps } from "./contract-form-fields";
import { paymentPlanLabel } from "./contract-payment-summary";

function civilDateBR(value: string | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function PaymentCalendar({
  preview,
}: {
  preview: NonNullable<FormProps["preview"]>;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {open ? "Ocultar calendário" : "Ver calendário completo"}
      </Button>
      <div
        id={id}
        hidden={!open}
        className="max-h-64 overflow-y-auto rounded-md border border-border"
      >
        <ol aria-label="Calendário de parcelas" className="divide-y divide-border">
          {preview.installments.map((row) => (
            <li
              key={row.sequenceNumber}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-caption font-numeric tabular-nums"
            >
              <span>Parcela {row.sequenceNumber}</span>
              <time dateTime={row.dueDate}>{civilDateBR(row.dueDate)}</time>
              <span>{formatBRLFromCents(row.amountCents)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function PaymentPreview({ preview }: { preview: NonNullable<FormProps["preview"]> }): ReactElement {
  const firstAmount = preview.installments[0]?.amountCents ?? null;
  const uniformAmount = preview.installments.every((row) => row.amountCents === firstAmount)
    ? firstAmount
    : null;
  return (
    <>
      <div
        className="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-caption font-numeric tabular-nums"
        aria-live="polite"
      >
        <p>
          Vigência até {civilDateBR(preview.endsOn)} · principal{" "}
          {formatBRLFromCents(preview.principalAmountCents)}
        </p>
        <p>{paymentPlanLabel(preview.installments.length, uniformAmount)}</p>
        <p className="text-muted-foreground">
          Mensalidade de referência em dia {formatBRLFromCents(preview.onTimeMonthlyCents)} · piso
          da mensalidade acordada {formatBRLFromCents(preview.floorCents)}
        </p>
        <p>
          Primeiro vencimento {civilDateBR(preview.installments[0]?.dueDate)} · último{" "}
          {civilDateBR(preview.installments.at(-1)?.dueDate)}
        </p>
      </div>
      <PaymentCalendar preview={preview} />
    </>
  );
}

export function PaymentSection({ fields, errors, change, preview }: FormProps): ReactElement {
  const id = useId();
  const special = fields.paymentPlan === "special";
  return (
    <FormSection title="Plano de pagamento">
      <Button
        type="button"
        variant="secondary"
        aria-expanded={special}
        aria-controls={id}
        onClick={() => change("paymentPlan", special ? "common" : "special")}
      >
        {special ? "Voltar ao plano comum" : "Parcelamento especial"}
      </Button>
      <div id={id} hidden={!special} className="space-y-2">
        {special && (
          <Field name="installmentCount">
            <Label>Quantidade de parcelas</Label>
            <Input
              name="installmentCount"
              autoComplete="off"
              inputMode="numeric"
              size="sm"
              value={fields.installmentCount}
              invalid={Boolean(errors.installmentCount)}
              onChange={(event) => change("installmentCount", event.target.value)}
              aria-describedby={`${id}-help`}
            />
            <p id={`${id}-help`} className="text-caption text-muted-foreground">
              De 1 até a duração do contrato em meses. O principal e a vigência permanecem iguais.
            </p>
            {errors.installmentCount && <FieldError match>{errors.installmentCount}</FieldError>}
          </Field>
        )}
      </div>
      {preview ? (
        <PaymentPreview preview={preview} />
      ) : (
        <p className="text-caption text-muted-foreground">
          Informe as datas, a mensalidade e uma quantidade válida para conferir as cobranças.
        </p>
      )}
    </FormSection>
  );
}
