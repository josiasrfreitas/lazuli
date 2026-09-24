"use client";

import type { ReactElement } from "react";
import { Field, FieldError, FormRow, FormSection, Input, Label } from "@lazuli/ui";
import { formatBRLFromCents } from "~/lib/format";
import { maskDateBR } from "~/lib/masks";
import type { ContractFields } from "./contract-form-model";
import { PartyPicker } from "./party-picker";

function TextField({
  name,
  label,
  value,
  onChange,
  error,
  placeholder,
  numeric = false,
  date = false,
}: {
  name: keyof ContractFields;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  placeholder: string;
  numeric?: boolean;
  date?: boolean;
}): ReactElement {
  return (
    <Field name={name}>
      <Label>{label}</Label>
      <Input
        autoComplete="off"
        inputMode={numeric ? "decimal" : "text"}
        invalid={Boolean(error)}
        name={name}
        onChange={(event) => onChange(date ? maskDateBR(event.target.value) : event.target.value)}
        placeholder={placeholder}
        size="sm"
        value={value}
      />
      {error && <FieldError match>{error}</FieldError>}
    </Field>
  );
}

export function ContractFormFields({
  fields,
  errors,
  offer,
  preview,
  change,
}: {
  fields: ContractFields;
  errors: Partial<Record<keyof ContractFields, string>>;
  offer:
    | {
        tuitionCeilingCents: number;
        maximumDiscountPct: number;
        interestRatePctDaily: number;
        interestRatePctMonthly: number;
        cancellationFeePct: number;
      }
    | null
    | undefined;
  preview: {
    endsOn: string;
    principalAmountCents: number;
    onTimeMonthlyCents: number;
    floorCents: number;
    installments: Array<{ dueDate: string }>;
  } | null;
  change: (name: keyof ContractFields, value: string) => void;
}): ReactElement {
  return (
    <>
      <FormSection title="Beneficiário e pagador">
        <FormRow columns={2}>
          <PartyPicker
            kind="student"
            value={fields.studentId}
            onChange={(value) => change("studentId", value)}
            error={errors.studentId}
          />
          <PartyPicker
            kind="payer"
            value={fields.payerId}
            onChange={(value) => change("payerId", value)}
            error={errors.payerId}
          />
        </FormRow>
      </FormSection>
      <FormSection title="Condições do contrato">
        <FormRow columns={2}>
          <TextField
            name="agreedOn"
            label="Fechamento"
            placeholder="dd/mm/aaaa"
            date
            value={fields.agreedOn}
            onChange={(value) => change("agreedOn", value)}
            error={errors.agreedOn}
          />
          <TextField
            name="startsOn"
            label="Início da vigência"
            placeholder="dd/mm/aaaa"
            date
            value={fields.startsOn}
            onChange={(value) => change("startsOn", value)}
            error={errors.startsOn}
          />
          <TextField
            name="durationMonths"
            label="Duração (meses)"
            placeholder="12"
            numeric
            value={fields.durationMonths}
            onChange={(value) => change("durationMonths", value)}
            error={errors.durationMonths}
          />
          <TextField
            name="monthlyAmount"
            label="Mensalidade nominal (R$)"
            placeholder="250,00"
            numeric
            value={fields.monthlyAmount}
            onChange={(value) => change("monthlyAmount", value)}
            error={errors.monthlyAmount}
          />
          <TextField
            name="punctualityDiscountPct"
            label="Pontualidade (%)"
            placeholder="0"
            numeric
            value={fields.punctualityDiscountPct}
            onChange={(value) => change("punctualityDiscountPct", value)}
            error={errors.punctualityDiscountPct}
          />
        </FormRow>
        {offer && (
          <p className="text-caption text-muted-foreground">
            Teto {formatBRLFromCents(offer.tuitionCeilingCents)} · desconto máximo{" "}
            {offer.maximumDiscountPct}% · juros {offer.interestRatePctDaily}% ao dia e{" "}
            {offer.interestRatePctMonthly}% ao mês · multa rescisória {offer.cancellationFeePct}%
          </p>
        )}
      </FormSection>
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
        {preview && (
          <div
            className="rounded-md border border-border bg-muted/30 p-3 text-caption"
            aria-live="polite"
          >
            <p>
              Vigência até {preview.endsOn.split("-").reverse().join("/")} · principal{" "}
              {formatBRLFromCents(preview.principalAmountCents)}
            </p>
            <p>
              {preview.installments.length} cobranças mensais de{" "}
              {formatBRLFromCents(
                fields.monthlyAmount ? Number(fields.monthlyAmount.replace(",", ".")) * 100 : 0,
              )}{" "}
              · em dia {formatBRLFromCents(preview.onTimeMonthlyCents)} · piso{" "}
              {formatBRLFromCents(preview.floorCents)}
            </p>
            <p>
              Primeiro vencimento {preview.installments[0]?.dueDate.split("-").reverse().join("/")}{" "}
              · último {preview.installments.at(-1)?.dueDate.split("-").reverse().join("/")}
            </p>
          </div>
        )}
      </FormSection>
    </>
  );
}
