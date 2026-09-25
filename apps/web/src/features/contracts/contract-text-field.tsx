"use client";

import type { ReactElement } from "react";
import { Field, FieldError, Input, Label } from "@lazuli/ui";
import type { ContractFields } from "./contract-form-model";

type TextFieldProps = {
  name: keyof ContractFields;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (() => void) | undefined;
  error?: string | undefined;
  placeholder: string;
  numeric?: boolean;
  date?: boolean;
};

function reverseDate(value: string, separator: "-" | "/"): string {
  if (!value) return "";
  const [first, middle, last] = value.split(separator);
  return [last, middle, first].join(separator === "-" ? "/" : "-");
}

export function TextField({
  name,
  label,
  value,
  onChange,
  onBlur,
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
        onBlur={onBlur}
        onChange={(event) =>
          onChange(date ? reverseDate(event.target.value, "-") : event.target.value)
        }
        onClick={(event) => {
          if (date) event.currentTarget.showPicker?.();
        }}
        placeholder={placeholder}
        size="sm"
        type={date ? "date" : "text"}
        value={date ? reverseDate(value, "/") : value}
      />
      {error && <FieldError match>{error}</FieldError>}
    </Field>
  );
}
