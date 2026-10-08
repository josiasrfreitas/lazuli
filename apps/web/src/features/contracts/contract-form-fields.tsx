"use client";

import type { ReactElement } from "react";
import { Button, CurrencyInput, Field, FieldError, FormRow, Label } from "@lazuli/ui";
import { UserMinus, UserPlus } from "lucide-react";
import { formatBRLFromCents } from "~/lib/format";
import { maskPhoneBR } from "~/lib/masks";
import type { ContractFields } from "./contract-form-model";
import { PaymentSection } from "./contract-payment-section";
import { TextField } from "./contract-text-field";
import { ContractPayerFields } from "./contract-payer-fields";
import { PartyPicker } from "./party-picker";
import { InlinePersonFields, PersonDocument } from "./contract-person-fields";

const CENTS_PER_REAL = 100;

export type FormProps = {
  maskedDates?: boolean;
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

type StudentProps = Pick<FormProps, "fields" | "errors" | "change">;

function GuardianFields({ fields, errors, change }: StudentProps): ReactElement {
  const open = fields.studentGuardianMode === "create";
  const toggle = (): void => {
    change("studentGuardianMode", open ? "" : "create");
    if (!open) return;
    change("studentGuardianName", "");
    change("studentGuardianPhone", "");
    change("studentGuardianEmail", "");
  };
  return (
    <>
      <Button type="button" size="sm" variant="ghost" onClick={toggle}>
        {open ? <UserMinus aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
        {open ? "Remover responsável" : "Adicionar responsável"}
      </Button>
      {open && (
        <div className="space-y-3">
          <TextField
            name="studentGuardianName"
            label="Nome do responsável"
            placeholder="Nome completo do responsável"
            value={fields.studentGuardianName}
            error={errors.studentGuardianName}
            onChange={(value) => change("studentGuardianName", value)}
          />
          <FormRow columns={2}>
            <TextField
              name="studentGuardianPhone"
              label="Telefone (opcional)"
              placeholder="(00) 00000-0000"
              value={fields.studentGuardianPhone}
              error={errors.studentGuardianPhone}
              onChange={(value) => change("studentGuardianPhone", maskPhoneBR(value))}
            />
            <TextField
              name="studentGuardianEmail"
              label="Email (opcional)"
              placeholder="nome@exemplo.com"
              value={fields.studentGuardianEmail}
              error={errors.studentGuardianEmail}
              onChange={(value) => change("studentGuardianEmail", value)}
            />
          </FormRow>
        </div>
      )}
    </>
  );
}

function ContractStudentField(props: StudentProps): ReactElement {
  const { fields, errors, change } = props;
  return (
    <div className="space-y-3">
      <FormRow columns={fields.studentMode === "create" ? 2 : 1}>
        <PartyPicker
          kind="student"
          createMode={fields.studentMode === "create"}
          draftName={fields.studentDraftName}
          value={
            fields.studentMode === "existing" && fields.studentId
              ? { id: fields.studentId, label: fields.studentName }
              : null
          }
          onChange={(option) => {
            if (option) change("studentMode", "existing");
            change("studentId", option?.id ?? "");
            change("studentName", option?.label ?? "");
          }}
          onClear={() => {
            change("studentMode", "existing");
            change("studentId", "");
            change("studentName", "");
          }}
          onSearchChange={(query) => change("studentDraftName", query)}
          onCreate={(query) => {
            change("studentMode", "create");
            change("studentDraftName", query.trim());
          }}
          error={fields.studentMode === "create" ? errors.studentDraftName : errors.studentId}
        />
        {fields.studentMode === "create" && <PersonDocument {...props} kind="student" />}
      </FormRow>
      {fields.studentMode === "create" && (
        <>
          <InlinePersonFields {...props} kind="student" />
          <GuardianFields {...props} />
        </>
      )}
    </div>
  );
}

function PartiesSection({ fields, errors, change }: FormProps): ReactElement {
  const creatingPerson = fields.studentMode === "create" || fields.payerMode === "create";
  return (
    <div className="grid min-w-0 gap-3">
      <FormRow columns={creatingPerson ? 1 : 2}>
        <ContractStudentField fields={fields} errors={errors} change={change} />
        <ContractPayerFields fields={fields} errors={errors} change={change} />
      </FormRow>
    </div>
  );
}

function TermFields({ fields, errors, change, maskedDates }: FormProps): ReactElement {
  return (
    <>
      <TextField
        name="agreedOn"
        label="Data do acordo"
        placeholder="dd/mm/aaaa"
        date
        maskedDate={maskedDates}
        value={fields.agreedOn}
        onChange={(value) => change("agreedOn", value)}
        error={errors.agreedOn}
      />
      <TextField
        name="firstDueDate"
        label="Início da vigência"
        placeholder="dd/mm/aaaa"
        date
        maskedDate={maskedDates}
        value={fields.firstDueDate}
        onChange={(value) => change("firstDueDate", value)}
        error={errors.firstDueDate}
      />
      <TextField
        name="endsOn"
        label="Fim da vigência"
        placeholder="dd/mm/aaaa"
        date
        maskedDate={maskedDates}
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

export function ConditionsSection(props: FormProps): ReactElement {
  const { offer } = props;
  return (
    <div className="grid min-w-0 gap-3">
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
    </div>
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
