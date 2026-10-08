"use client";
import type { ReactElement } from "react";
import {
  Field,
  FieldError,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lazuli/ui";

export function SelectControl({
  name,
  label,
  value,
  onChange,
  choices,
  error,
  hideLabel = false,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  choices: { value: string; label: string }[];
  error?: string | undefined;
  hideLabel?: boolean;
}): ReactElement {
  return (
    <Field name={name} className={hideLabel ? "self-end" : undefined}>
      <Label htmlFor={name} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </Label>
      <Select
        name={name}
        items={choices}
        value={value || null}
        onValueChange={(selected) => onChange(selected ?? "")}
      >
        <SelectTrigger id={name} size="sm" invalid={Boolean(error)}>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError match={Boolean(error)}>{error}</FieldError>
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
  invalid,
}: {
  name: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  inputMode?: "numeric" | undefined;
  invalid?: boolean | undefined;
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
        invalid={invalid ?? Boolean(error)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldError match={Boolean(error)}>{error}</FieldError>
    </Field>
  );
}
