"use client";

import type { ReactElement } from "react";
import { FormRow } from "@lazuli/ui";
import { detectPersonDocument } from "@lazuli/validators";
import { maskPhoneBR } from "~/lib/masks";
import type { FormProps } from "./contract-form-fields";
import { TextField } from "./contract-text-field";

type PersonProps = Pick<FormProps, "fields" | "errors" | "change"> & { kind: "student" | "payer" };
const PERSON_FIELDS = {
  student: {
    documentType: "studentDocumentType",
    documentNumber: "studentDocumentNumber",
    phone: "studentPhone",
    email: "studentEmail",
  },
  payer: {
    documentType: "payerDocumentType",
    documentNumber: "payerDocumentNumber",
    phone: "payerPhone",
    email: "payerEmail",
  },
} as const;

export function PersonDocument({ kind, fields, errors, change }: PersonProps): ReactElement {
  const names = PERSON_FIELDS[kind];
  return (
    <TextField
      name={names.documentNumber}
      label="CPF ou RG (opcional)"
      placeholder="Digite o CPF ou RG"
      value={fields[names.documentNumber]}
      error={errors[names.documentNumber] ?? errors[names.documentType]}
      onChange={(value) => {
        const document = detectPersonDocument(value);
        change(names.documentNumber, document.documentNumber);
        change(names.documentType, document.documentType ?? "");
      }}
    />
  );
}

export function InlinePersonFields(props: PersonProps): ReactElement {
  const { kind, fields, errors, change } = props;
  const names = PERSON_FIELDS[kind];
  const entity = kind === "student" ? "aluno" : "pagador";
  return (
    <div className="space-y-3">
      <FormRow columns={2}>
        <TextField
          name={names.phone}
          label="Telefone (opcional)"
          placeholder="(00) 00000-0000"
          value={fields[names.phone]}
          error={errors[names.phone]}
          onChange={(value) => change(names.phone, maskPhoneBR(value))}
        />
        <TextField
          name={names.email}
          label="Email (opcional)"
          placeholder="nome@exemplo.com"
          value={fields[names.email]}
          error={errors[names.email]}
          onChange={(value) => change(names.email, value)}
        />
      </FormRow>
      <p className="text-caption text-muted-foreground">
        O {entity} será cadastrado ao criar o contrato.
      </p>
    </div>
  );
}
