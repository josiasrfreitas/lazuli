"use client";

import type { ReactElement } from "react";
import { FormRow, FormSection } from "@lazuli/ui";
import { formatBRLFromCents } from "~/lib/format";
import type { ContractFields } from "./contract-form-model";
import { PartyPicker } from "./party-picker";
import { PaymentSection } from "./contract-payment-section";
import { TextField } from "./contract-text-field";
import { ContractPayerFields } from "./contract-payer-fields";

export type FormProps = {
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
};

function PartiesSection({ fields, errors, change }: FormProps): ReactElement {
  return (
    <FormSection title="Beneficiário e pagador">
      <div className="space-y-4">
        <PartyPicker
          kind="student"
          value={fields.studentId}
          onChange={(value) => change("studentId", value)}
          error={errors.studentId}
        />
        <ContractPayerFields fields={fields} errors={errors} change={change} />
      </div>
    </FormSection>
  );
}

function TermFields({ fields, errors, change }: FormProps): ReactElement {
  return (
    <>
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
    </>
  );
}

function PriceFields({ fields, errors, change }: FormProps): ReactElement {
  return (
    <>
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
    </>
  );
}

function ConditionsSection(props: FormProps): ReactElement {
  const { offer } = props;
  return (
    <FormSection title="Condições do contrato">
      <FormRow columns={2}>
        <TermFields {...props} />
        <PriceFields {...props} />
      </FormRow>
      {offer && (
        <p className="text-caption text-muted-foreground">
          Teto {formatBRLFromCents(offer.tuitionCeilingCents)} · desconto máximo{" "}
          {offer.maximumDiscountPct.toLocaleString("pt-BR")}% · juros{" "}
          {offer.interestRatePctDaily.toLocaleString("pt-BR")}% ao dia e{" "}
          {offer.interestRatePctMonthly.toLocaleString("pt-BR")}% ao mês · multa rescisória{" "}
          {offer.cancellationFeePct.toLocaleString("pt-BR")}%
        </p>
      )}
    </FormSection>
  );
}

export function ContractFormFields(props: FormProps): ReactElement {
  return (
    <>
      <PartiesSection {...props} />
      <ConditionsSection {...props} />
      <PaymentSection {...props} />
    </>
  );
}
