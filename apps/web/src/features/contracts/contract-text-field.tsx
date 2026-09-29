"use client";

import type { ReactElement } from "react";
import { Field, FieldError, Input, Label } from "@lazuli/ui";
import type { ContractFields } from "./contract-form-model";
import { maskDateBR } from "~/lib/masks";

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
  maskedDate?: boolean | undefined;
};

function reverseDate(value: string, separator: "-" | "/"): string {
  if (!value) return "";
  const [first, middle, last] = value.split(separator);
  return [last, middle, first].join(separator === "-" ? "/" : "-");
}

function controlMode(input: {
  numeric: boolean;
  maskedDate: boolean;
}): "numeric" | "decimal" | "text" {
  if (input.maskedDate) return "numeric";
  return input.numeric ? "decimal" : "text";
}

function typedValue(value: string, input: { date: boolean; maskedDate: boolean }): string {
  if (input.maskedDate) return maskDateBR(value);
  return input.date ? reverseDate(value, "-") : value;
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
  maskedDate = false,
}: TextFieldProps): ReactElement {
  return (
    <Field name={name}>
      <Label>{label}</Label>
      <Input
        autoComplete="off"
        inputMode={controlMode({ numeric, maskedDate })}
        invalid={Boolean(error)}
        name={name}
        onBlur={onBlur}
        onChange={(event) => onChange(typedValue(event.target.value, { date, maskedDate }))}
        onClick={(event) => {
          if (date && !maskedDate) event.currentTarget.showPicker?.();
        }}
        placeholder={placeholder}
        size="sm"
        type={date && !maskedDate ? "date" : "text"}
        value={date && !maskedDate ? reverseDate(value, "/") : value}
      />
      {error && <FieldError match>{error}</FieldError>}
    </Field>
  );
}
