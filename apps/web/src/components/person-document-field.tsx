import type { ReactElement } from "react";
import { Field, FieldError, Input, Label } from "@lazuli/ui";
import { detectPersonDocument } from "@lazuli/validators";

type Props = {
  name: string;
  requiredCpf?: boolean;
  value: string;
  error?: string | undefined;
  onChange: (document: { documentType: "CPF" | "RG" | undefined; documentNumber: string }) => void;
};

export function PersonDocumentField({
  name,
  value,
  error,
  onChange,
  requiredCpf = false,
}: Props): ReactElement {
  return (
    <Field name={name}>
      <Label>{requiredCpf ? "CPF" : "CPF ou RG (opcional)"}</Label>
      <Input
        autoComplete="off"
        inputMode={requiredCpf ? "numeric" : undefined}
        invalid={Boolean(error)}
        name={name}
        onChange={(event) => onChange(detectPersonDocument(event.target.value))}
        placeholder={requiredCpf ? "000.000.000-00" : "Digite o CPF ou RG"}
        size={requiredCpf ? "compact-responsive" : "sm"}
        value={value}
      />
      {error && <FieldError match>{error}</FieldError>}
    </Field>
  );
}
