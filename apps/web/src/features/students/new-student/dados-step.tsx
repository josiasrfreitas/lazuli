import type { ComponentProps, FormEvent, ReactElement } from "react";
import { UserMinus, UserPlus } from "lucide-react";

import { Button, Field, FieldError, FormRow, FormSection, Input, Label } from "@lazuli/ui";
import { PersonDocumentField } from "~/components/person-document-field";
import { parseDateBR } from "~/lib/masks";

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

type GuardianSectionProps = FieldsProps & {
  minor: boolean;
  open: boolean;
  onToggle: (open: boolean) => void;
};

const MINOR_DESCRIPTION = "Obrigatório para menores de idade: nome e telefone ou email.";
const ADULT_DESCRIPTION = "Opcional para adultos.";

function GuardianFields({
  errors,
  fields,
  minor,
  onFieldChange,
}: FieldsProps & { minor: boolean }): ReactElement {
  return (
    <>
      <TextField
        error={errors.guardianName}
        label="Nome do responsável"
        name="guardianName"
        onChange={onFieldChange}
        placeholder="Nome completo do responsável"
        required={minor}
        value={fields.guardianName}
      />
      <FormRow columns={2}>
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
      </FormRow>
    </>
  );
}

function GuardianSection(props: GuardianSectionProps): ReactElement {
  const { minor, onToggle, open } = props;
  const action = minor ? undefined : (
    <Button onClick={() => onToggle(!open)} size="sm" type="button" variant="ghost">
      {open ? <UserMinus aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
      {open ? "Remover responsável" : "Adicionar responsável"}
    </Button>
  );

  return (
    <FormSection
      action={action}
      description={minor ? MINOR_DESCRIPTION : ADULT_DESCRIPTION}
      title="Responsável"
    >
      {open ? <GuardianFields {...props} /> : null}
    </FormSection>
  );
}

export type DadosStepProps = FieldsProps & {
  minor: boolean;
  guardianOpen: boolean;
  onGuardianToggle: (open: boolean) => void;
  /** Enter in any field and the footer's "Avançar" both land here. */
  onSubmit: () => void;
};

/** Name and birth date first: the date decides whether a guardian is required. */
function IdentitySection(props: FieldsProps): ReactElement {
  const { errors, fields, onFieldChange } = props;

  return (
    <FormSection title="Identificação">
      <TextField
        error={errors.fullName}
        label="Nome completo"
        name="fullName"
        onChange={onFieldChange}
        placeholder="Como está no documento"
        required
        value={fields.fullName}
      />
      <FormRow columns={2}>
        <BirthDateField {...props} />
        <DocumentFields {...props} />
      </FormRow>
    </FormSection>
  );
}

function ContactSection({ errors, fields, onFieldChange }: FieldsProps): ReactElement {
  return (
    <FormSection title="Contato">
      <FormRow columns={2}>
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
    </FormSection>
  );
}

/**
 * Step 1 of the wizard: identity, contact, guardian. A real `form` so Enter
 * advances; the footer submits it by `id` from outside the scrolling body.
 */
export function DadosStep(props: DadosStepProps): ReactElement {
  const { guardianOpen, minor, onGuardianToggle, onSubmit, ...fieldsProps } = props;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="grid gap-5" id={DADOS_FORM_ID} noValidate onSubmit={handleSubmit}>
      <IdentitySection {...fieldsProps} />
      <ContactSection {...fieldsProps} />
      <GuardianSection
        {...fieldsProps}
        minor={minor}
        onToggle={onGuardianToggle}
        open={guardianOpen}
      />
    </form>
  );
}
