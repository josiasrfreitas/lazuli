"use client";

import type { ReactElement } from "react";
import {
  Field,
  FieldError,
  FormRow,
  Label,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import type { ContractFields } from "./contract-form-model";
import type { FormProps } from "./contract-form-fields";
import { PartyPicker } from "./party-picker";
import { TextField } from "./contract-text-field";
import { maskPhoneBR } from "~/lib/masks";

type PayerProps = Pick<FormProps, "fields" | "errors" | "change">;

function PayerTextField({
  name,
  label,
  placeholder,
  fields,
  errors,
  change,
}: PayerProps & {
  name: keyof ContractFields;
  label: string;
  placeholder: string;
}): ReactElement {
  return (
    <TextField
      name={name}
      label={label}
      placeholder={placeholder}
      value={fields[name]}
      error={errors[name]}
      onChange={(value) => change(name, name === "payerPhone" ? maskPhoneBR(value) : value)}
    />
  );
}

function PayerDocumentType({ fields, errors, change }: PayerProps): ReactElement {
  return (
    <Field name="payerDocumentType">
      <Label id="payer-document-label">Documento (opcional)</Label>
      <SegmentedControl
        size="sm"
        aria-labelledby="payer-document-label"
        value={fields.payerDocumentType || null}
        invalid={Boolean(errors.payerDocumentType)}
        onValueChange={(value) => change("payerDocumentType", value ?? "")}
      >
        <SegmentedControlItem value="CPF">CPF</SegmentedControlItem>
        <SegmentedControlItem value="RG">RG</SegmentedControlItem>
      </SegmentedControl>
      <FieldError match={Boolean(errors.payerDocumentType)}>{errors.payerDocumentType}</FieldError>
    </Field>
  );
}

function NewPayerFields(props: PayerProps): ReactElement {
  return (
    <div className="space-y-3">
      <PayerTextField
        {...props}
        name="payerName"
        label="Nome do pagador"
        placeholder="Nome completo"
      />
      <FormRow columns={2}>
        <PayerDocumentType {...props} />
        <PayerTextField
          {...props}
          name="payerDocumentNumber"
          label="Número (opcional)"
          placeholder="Número do documento"
        />
        <PayerTextField
          {...props}
          name="payerPhone"
          label="Telefone (opcional)"
          placeholder="(00) 00000-0000"
        />
        <PayerTextField
          {...props}
          name="payerEmail"
          label="Email (opcional)"
          placeholder="nome@exemplo.com"
        />
      </FormRow>
      <p className="text-caption text-muted-foreground">
        O pagador será cadastrado ao criar o contrato.
      </p>
    </div>
  );
}

export function ContractPayerFields(props: PayerProps): ReactElement {
  const { fields, errors, change } = props;
  return (
    <div className="space-y-3">
      <SegmentedControl
        aria-label="Cadastro do pagador"
        size="sm"
        value={fields.payerMode}
        onValueChange={(value) => {
          if (value) change("payerMode", value);
        }}
      >
        <SegmentedControlItem value="existing">Buscar existente</SegmentedControlItem>
        <SegmentedControlItem value="create">Cadastrar novo</SegmentedControlItem>
      </SegmentedControl>
      <div hidden={fields.payerMode !== "existing"}>
        <PartyPicker
          kind="payer"
          value={fields.payerId}
          onChange={(value) => change("payerId", value)}
          error={errors.payerId}
        />
      </div>
      {fields.payerMode === "create" && <NewPayerFields {...props} />}
    </div>
  );
}
