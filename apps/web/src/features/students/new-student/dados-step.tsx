import type { FormEvent, ReactElement } from "react";

import { FormRow, FormSection } from "@lazuli/ui";

import { DocumentFields, TextField, type FieldsProps } from "./dados-fields";
import { GuardianSection } from "./guardian-section";

export const DADOS_FORM_ID = "new-student-dados";

const BIRTH_DATE_LENGTH = 10;

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
      <FormRow className="sm:grid-cols-[8.5rem_auto_1fr]">
        <TextField
          error={errors.birthDate}
          inputMode="numeric"
          label="Nascimento"
          maxLength={BIRTH_DATE_LENGTH}
          name="birthDate"
          onChange={onFieldChange}
          placeholder="dd/mm/aaaa"
          value={fields.birthDate}
        />
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
