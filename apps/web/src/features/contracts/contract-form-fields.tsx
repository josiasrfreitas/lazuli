"use client";

import type { ReactElement } from "react";
import { CurrencyInput, Field, FieldError, FormRow, FormSection, Label } from "@lazuli/ui";
import { formatBRLFromCents } from "~/lib/format";
import type { ContractFields } from "./contract-form-model";
import { ContractStudentField } from "./contract-student-field";
import { PaymentSection } from "./contract-payment-section";
import { TextField } from "./contract-text-field";
import { ContractPayerFields } from "./contract-payer-fields";

const CENTS_PER_REAL = 100;

export type FormProps = {
  fields: ContractFields;
  errors: Partial<Record<keyof ContractFields, string>>;
  offer:
    | {
        tuitionCeilingCents: number;
        maximumDiscountPct: number;
        punctualityDiscountPct: number;
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
    installments: Array<{ sequenceNumber: number; amountCents: number; dueDate: string }>;
  } | null;
  onMonthlyAmountBlur?: (() => void) | undefined;
  change: (name: keyof ContractFields, value: string) => void;
};

function PartiesSection({ fields, errors, change }: FormProps): ReactElement {
  const creatingPerson = fields.studentMode === "create" || fields.payerMode === "create";
  return (
    <FormSection title="Beneficiário e pagador">
      <FormRow columns={creatingPerson ? 1 : 2}>
        <ContractStudentField fields={fields} errors={errors} change={change} />
        <ContractPayerFields fields={fields} errors={errors} change={change} />
      </FormRow>
    </FormSection>
  );
}

function TermFields({ fields, errors, change }: FormProps): ReactElement {
  return (
    <>
      <TextField
        name="agreedOn"
        label="Data do acordo"
        placeholder="dd/mm/aaaa"
        date
        value={fields.agreedOn}
        onChange={(value) => change("agreedOn", value)}
        error={errors.agreedOn}
      />
      <TextField
        name="firstDueDate"
        label="Início da vigência"
        placeholder="dd/mm/aaaa"
        date
        value={fields.firstDueDate}
        onChange={(value) => change("firstDueDate", value)}
        error={errors.firstDueDate}
      />
      <TextField
        name="endsOn"
        label="Fim da vigência"
        placeholder="dd/mm/aaaa"
        date
        value={fields.endsOn}
        onChange={(value) => change("endsOn", value)}
        error={errors.endsOn}
      />
    </>
  );
}

function PriceFields({ fields, errors, change, onMonthlyAmountBlur }: FormProps): ReactElement {
  const [reais, centavos] = fields.monthlyAmount.replace(",", ".").split(".");
  const amount = Number(reais) * CENTS_PER_REAL + Number(centavos?.padEnd(2, "0") ?? 0);
  return (
    <Field name="monthlyAmount">
      <Label>Mensalidade acordada</Label>
      <CurrencyInput
        name="monthlyAmount"
        autoComplete="off"
        size="sm"
        invalid={Boolean(errors.monthlyAmount)}
        value={fields.monthlyAmount && Number.isSafeInteger(amount) ? amount : null}
        onValueChange={(cents) =>
          change("monthlyAmount", cents === null ? "" : (cents / CENTS_PER_REAL).toFixed(2))
        }
        onBlur={onMonthlyAmountBlur}
      />
      {errors.monthlyAmount && <FieldError match>{errors.monthlyAmount}</FieldError>}
    </Field>
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
          {offer.maximumDiscountPct.toLocaleString("pt-BR")}% · pontualidade{" "}
          {offer.punctualityDiscountPct.toLocaleString("pt-BR")}% · juros{" "}
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
