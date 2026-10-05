import type { ReactElement } from "react";
import { Field, FieldError, Input, Label } from "@lazuli/ui";
import { detectPersonDocument } from "@lazuli/validators";

type Props = {
  name: string;
  value: string;
  error?: string | undefined;
  onChange: (document: { documentType: "CPF" | "RG" | undefined; documentNumber: string }) => void;
};

export function PersonDocumentField({ name, value, error, onChange }: Props): ReactElement {
  return (
    <Field name={name}>
      <Label>CPF ou RG (opcional)</Label>
      <Input
        autoComplete="off"
        invalid={Boolean(error)}
        name={name}
        onChange={(event) => onChange(detectPersonDocument(event.target.value))}
        placeholder="Digite o CPF ou RG"
        size="sm"
        value={value}
      />
      {error && <FieldError match>{error}</FieldError>}
    </Field>
  );
}
