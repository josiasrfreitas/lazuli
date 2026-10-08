"use client";
import type { ReactElement } from "react";
import { Field, FieldError, Input, Label } from "@lazuli/ui";

export function NativeSelect({
  name,
  label,
  value,
  onChange,
  choices,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  choices: { value: string; label: string }[];
}): ReactElement {
  return (
    <Field>
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-control-sm w-full rounded-sm border border-input bg-background px-2 text-control text-foreground focus-visible:shadow-focus"
      >
        <option value="">Selecione</option>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function TextControl({
  name,
  label,
  placeholder,
  value,
  onChange,
  error,
  inputMode,
}: {
  name: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  inputMode?: "numeric" | undefined;
}): ReactElement {
  return (
    <Field>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        autoComplete="off"
        placeholder={placeholder}
        size="sm"
        inputMode={inputMode}
        invalid={Boolean(error)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldError match={Boolean(error)}>{error}</FieldError>
    </Field>
  );
}
