import type { ComponentProps, ReactElement } from "react";

import {
  Field,
  FieldError,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";

import type { NewStudentErrors, NewStudentFieldName, NewStudentFields } from "./reducer";

export type FieldChangeHandler = (field: NewStudentFieldName, value: string) => void;

export type FieldsProps = {
  fields: NewStudentFields;
  errors: NewStudentErrors;
  onFieldChange: FieldChangeHandler;
};

type InputAttributes = Pick<ComponentProps<"input">, "type" | "inputMode" | "maxLength">;

/**
 * Every text control of the wizard goes through here so the form contract
 * (placeholder, `name`, no browser autofill, dense size) holds by construction.
 */
export function TextField({
  label,
  name,
  placeholder,
  required = false,
  value,
  error,
  onChange,
  ...input
}: InputAttributes & {
  label: string;
  name: NewStudentFieldName;
  placeholder: string;
  required?: boolean;
  value: string;
  error: string | undefined;
  onChange: FieldChangeHandler;
}): ReactElement {
  return (
    <Field>
      <Label>{label}</Label>
      <Input
        {...input}
        aria-required={required || undefined}
        autoComplete="off"
        invalid={error !== undefined}
        name={name}
        onChange={(event) => {
          onChange(name, event.target.value);
        }}
        placeholder={placeholder}
        size="sm"
        value={value}
      />
      {error === undefined ? null : <FieldError match>{error}</FieldError>}
    </Field>
  );
}

const DOCUMENT_TYPES = [
  { label: "CPF", value: "CPF", placeholder: "000.000.000-00" },
  { label: "RG", value: "RG", placeholder: "00.000.000-0" },
] as const;
const DOCUMENT_TYPE_LABEL_ID = "new-student-document-type-label";
const DOCUMENT_NUMBER_PLACEHOLDER = "Número do documento";

/** Two options → inline pills, not a dropdown: one Tab stop, arrows to switch. */
export function DocumentFields({ errors, fields, onFieldChange }: FieldsProps): ReactElement {
  const error = errors.documentType;
  const selected = DOCUMENT_TYPES.find((type) => type.value === fields.documentType);

  return (
    <>
      <Field>
        <Label id={DOCUMENT_TYPE_LABEL_ID}>Documento</Label>
        <SegmentedControl
          aria-labelledby={DOCUMENT_TYPE_LABEL_ID}
          invalid={error !== undefined}
          onValueChange={(value) => {
            onFieldChange("documentType", value ?? "");
          }}
          size="sm"
          value={selected?.value ?? null}
        >
          {DOCUMENT_TYPES.map((type) => (
            <SegmentedControlItem key={type.value} value={type.value}>
              {type.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        {error === undefined ? null : <FieldError match>{error}</FieldError>}
      </Field>
      <TextField
        error={errors.documentNumber}
        inputMode="numeric"
        label="Número"
        name="documentNumber"
        onChange={onFieldChange}
        placeholder={selected?.placeholder ?? DOCUMENT_NUMBER_PLACEHOLDER}
        value={fields.documentNumber}
      />
    </>
  );
}
