import type { JSX as ReactJSX } from "react";
import type { ComponentProps, FormEvent, ReactElement, ReactNode } from "react";

import { Badge, Field, FieldError, FormRow, FormSection, Input, Label } from "@lazuli/ui";
import { PersonDocumentField } from "~/components/person-document-field";
import { parseDateBR } from "~/lib/masks";
import type { EnrollmentDocuments } from "~/features/student-documents/use-enrollment-documents";
import styles from "./enrollment-documents.module.css";

import type { NewStudentErrors, NewStudentFieldName, NewStudentFields } from "./reducer";

export const DADOS_FORM_ID = "new-student-dados";

export type FieldChangeHandler = (field: NewStudentFieldName, value: string) => void;

export type FieldsProps = {
  fields: NewStudentFields;
  errors: NewStudentErrors;
  onFieldChange: FieldChangeHandler;
};

type InputAttributes = Pick<ComponentProps<"input">, "type" | "inputMode" | "maxLength">;

function TextField({
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
        onChange={(event) => onChange(name, event.target.value)}
        placeholder={placeholder}
        size="sm"
        value={value}
      />
      {error === undefined ? null : <FieldError match>{error}</FieldError>}
    </Field>
  );
}

function DocumentFields({ errors, fields, onFieldChange }: FieldsProps): ReactElement {
  return (
    <PersonDocumentField
      error={errors.documentNumber ?? errors.documentType}
      required
      name="documentNumber"
      onChange={(document) => {
        onFieldChange("documentNumber", document.documentNumber);
        onFieldChange("documentType", document.documentType ?? "");
      }}
      value={fields.documentNumber}
    />
  );
}

function BirthDateField({ errors, fields, onFieldChange }: FieldsProps): ReactElement {
  return (
    <Field>
      <Label>Nascimento</Label>
      <Input
        autoComplete="off"
        invalid={errors.birthDate !== undefined}
        aria-required="true"
        name="birthDate"
        onChange={(event) => {
          const [year, month, day] = event.target.value.split("-");
          onFieldChange("birthDate", year && month && day ? `${day}/${month}/${year}` : "");
        }}
        placeholder="dd/mm/aaaa"
        size="sm"
        type="date"
        value={parseDateBR(fields.birthDate) ?? ""}
      />
      {errors.birthDate && <FieldError match>{errors.birthDate}</FieldError>}
    </Field>
  );
}

type GuardianSectionProps = FieldsProps & {
  minor: boolean;
  compact?: boolean;
  action?: ReactNode;
};

const MINOR_DESCRIPTION =
  "Obrigatório para menores de idade: nome, CPF ou RG e telefone ou e-mail.";

function GuardianFields({
  errors,
  fields,
  minor,
  onFieldChange,
  compact = false,
}: FieldsProps & { minor: boolean; compact?: boolean }): ReactElement {
  return (
    <div className="grid gap-3">
      <FormRow columns={2}>
        <TextField
          error={errors.guardianName}
          label="Nome do responsável"
          name="guardianName"
          onChange={onFieldChange}
          placeholder="Nome completo do responsável"
          required={minor}
          value={fields.guardianName}
        />
        <GuardianDocumentField
          fields={fields}
          errors={errors}
          onFieldChange={onFieldChange}
          minor={minor}
        />
      </FormRow>
      <div className={compact ? styles.guardianContacts : "grid gap-3 sm:grid-cols-2"}>
        <TextField
          error={errors.guardianPhone}
          inputMode="tel"
          label="Telefone"
          name="guardianPhone"
          onChange={onFieldChange}
          placeholder="(11) 99999-9999"
          type="tel"
          value={fields.guardianPhone}
        />
        <TextField
          error={errors.guardianEmail}
          label="Email"
          name="guardianEmail"
          onChange={onFieldChange}
          placeholder="nome@exemplo.com"
          type="email"
          value={fields.guardianEmail}
        />
      </div>
    </div>
  );
}

function GuardianDocumentField({
  fields,
  errors,
  onFieldChange,
  minor,
}: FieldsProps & { minor: boolean }): ReactElement {
  return (
    <PersonDocumentField
      required={minor || Boolean(fields.guardianName.trim())}
      name="guardianDocumentNumber"
      value={fields.guardianDocumentNumber}
      error={errors.guardianDocumentNumber ?? errors.guardianDocumentType}
      onChange={(document) => {
        onFieldChange("guardianDocumentNumber", document.documentNumber);
        onFieldChange("guardianDocumentType", document.documentType ?? "");
      }}
    />
  );
}

function GuardianSection(props: GuardianSectionProps): ReactElement {
  const { minor } = props;
  const description = props.compact || !minor ? undefined : MINOR_DESCRIPTION;

  return (
    <FormSection
      description={description}
      action={props.action}
      className="data-[compact=true]:col-span-full"
      data-compact={props.compact}
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          Responsável
          <Badge variant={minor ? "info" : "neutral"}>{minor ? "Obrigatório" : "Opcional"}</Badge>
        </span>
      }
    >
      <GuardianFields {...props} />
    </FormSection>
  );
}

export type DadosStepProps = FieldsProps & {
  minor: boolean;
  /** Enter in any field and the footer's "Avançar" both land here. */
  onSubmit: () => void;
};

/** Name and birth date first: the date decides whether a guardian is required. */
function IdentitySection(
  props: FieldsProps & { nameField?: ReactNode; action?: ReactNode },
): ReactElement {
  const { errors, fields, onFieldChange } = props;

  return (
    <FormSection title="Identificação" action={props.action}>
      {props.nameField ?? (
        <TextField
          error={errors.fullName}
          label="Nome completo"
          name="fullName"
          onChange={onFieldChange}
          placeholder="Como está no documento"
          required
          value={fields.fullName}
        />
      )}
      <FormRow columns={2}>
        <BirthDateField {...props} />
        <DocumentFields {...props} />
      </FormRow>
    </FormSection>
  );
}

function ContactSection({
  errors,
  fields,
  onFieldChange,
  stacked = false,
}: FieldsProps & { stacked?: boolean }): ReactElement {
  return (
    <FormRow columns={stacked ? 1 : 2} role="group" aria-label="Contato">
      <TextField
        error={errors.phone}
        inputMode="tel"
        label="Telefone"
        name="phone"
        onChange={onFieldChange}
        placeholder="(11) 99999-9999"
        type="tel"
        value={fields.phone}
      />
      <TextField
        error={errors.email}
        label="Email"
        name="email"
        onChange={onFieldChange}
        placeholder="nome@exemplo.com"
        type="email"
        value={fields.email}
      />
    </FormRow>
  );
}

/**
 * Step 1 of the wizard: identity, contact, guardian. A real `form` so Enter
 * advances; the footer submits it by `id` from outside the scrolling body.
 */
export function DadosStep(props: DadosStepProps): ReactElement {
  const { minor, onSubmit, ...fieldsProps } = props;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="grid gap-5" id={DADOS_FORM_ID} noValidate onSubmit={handleSubmit}>
      <IdentitySection {...fieldsProps} />
      <ContactSection {...fieldsProps} />
      <GuardianSection {...fieldsProps} minor={minor} />
    </form>
  );
}

export function IntakeStudentFields(
  props: Omit<DadosStepProps, "onSubmit"> & {
    nameField: ReactNode;
    documents: EnrollmentDocuments;
    studentId?: string | undefined;
  },
): ReactJSX.Element {
  return (
    <div className="grid gap-5">
      <IdentitySection {...props} />
      <ContactSection {...props} />
      <GuardianSection {...props} />
    </div>
  );
}
