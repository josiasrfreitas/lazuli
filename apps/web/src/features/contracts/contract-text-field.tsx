"use client";

import type { ReactElement } from "react";
import { Field, FieldError, Input, Label } from "@lazuli/ui";
import { maskDateBR } from "~/lib/masks";
import type { ContractFields } from "./contract-form-model";

type TextFieldProps = {
  name: keyof ContractFields;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  placeholder: string;
  numeric?: boolean;
  date?: boolean;
};

export function TextField({
  name,
  label,
  value,
  onChange,
  error,
  placeholder,
  numeric = false,
  date = false,
}: TextFieldProps): ReactElement {
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
