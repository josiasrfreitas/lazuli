import type { ComponentProps, ReactElement } from "react";

import { Field, FieldError, Input, Label } from "@lazuli/ui";
import { PersonDocumentField } from "~/components/person-document-field";
import { parseDateBR } from "~/lib/masks";

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

export function DocumentFields({ errors, fields, onFieldChange }: FieldsProps): ReactElement {
  return (
    <PersonDocumentField
      error={errors.documentNumber ?? errors.documentType}
      name="documentNumber"
      onChange={(document) => {
        onFieldChange("documentNumber", document.documentNumber);
        onFieldChange("documentType", document.documentType ?? "");
      }}
      value={fields.documentNumber}
    />
  );
}

export function BirthDateField({ errors, fields, onFieldChange }: FieldsProps): ReactElement {
  return (
    <Field>
      <Label>Nascimento</Label>
      <Input
        autoComplete="off"
        invalid={errors.birthDate !== undefined}
        name="birthDate"
        onChange={(event) => {
          const [year, month, day] = event.target.value.split("-");
          onFieldChange("birthDate", year && month && day ? `${day}/${month}/${year}` : "");
        }}
        onClick={(event) => event.currentTarget.showPicker?.()}
        placeholder="dd/mm/aaaa"
        size="sm"
        type="date"
        value={parseDateBR(fields.birthDate) ?? ""}
      />
      {errors.birthDate && <FieldError match>{errors.birthDate}</FieldError>}
    </Field>
  );
}
