import type { ReactElement } from "react";

import { Button, FormRow, FormSection } from "@lazuli/ui";
import { UserMinus, UserPlus } from "lucide-react";

import { TextField, type FieldsProps } from "./dados-fields";

export type GuardianSectionProps = FieldsProps & {
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

/**
 * Progressive disclosure: minors always see the guardian fields; for adults
 * the section collapses to a single "Adicionar responsável" action.
 */
export function GuardianSection(props: GuardianSectionProps): ReactElement {
  const { minor, onToggle, open } = props;
  const action = minor ? undefined : (
    <Button
      onClick={() => {
        onToggle(!open);
      }}
      size="sm"
      type="button"
      variant="ghost"
    >
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
