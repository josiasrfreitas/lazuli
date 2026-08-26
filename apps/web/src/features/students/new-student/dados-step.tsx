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

import type { NewStudentErrors, NewStudentFieldName, NewStudentFields } from "./reducer";

export type FieldChangeHandler = (field: NewStudentFieldName, value: string) => void;

type StepProps = {
  fields: NewStudentFields;
  errors: NewStudentErrors;
  minor: boolean;
  onFieldChange: FieldChangeHandler;
};

const DOCUMENT_ITEMS = [
  { label: "CPF", value: "CPF" },
  { label: "RG", value: "RG" },
];

function TextField({
  label,
  name,
  type = "text",
  required = false,
  value,
  error,
  onChange,
}: {
  label: string;
  name: NewStudentFieldName;
  type?: string;
  required?: boolean;
  value: string;
  error: string | undefined;
  onChange: FieldChangeHandler;
}): ReactElement {
  return (
    <Field>
      <Label>{label}</Label>
      <Input
        aria-required={required || undefined}
        invalid={error !== undefined}
        onChange={(event) => {
          onChange(name, event.target.value);
        }}
        type={type}
        value={value}
      />
      {error === undefined ? null : <FieldError match>{error}</FieldError>}
    </Field>
  );
}

function DocumentFields({ errors, fields, onFieldChange }: StepProps): ReactElement {
  const error = errors.documentType;

  return (
    <div className="grid grid-cols-[7rem_1fr] items-start gap-3">
      <Field>
        <Label>Documento</Label>
        <Select
          items={DOCUMENT_ITEMS}
          onValueChange={(value) => {
            onFieldChange("documentType", value ?? "");
          }}
          value={fields.documentType === "" ? null : fields.documentType}
        >
          <SelectTrigger aria-label="Tipo do documento" invalid={error !== undefined}>
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error === undefined ? null : <FieldError match>{error}</FieldError>}
      </Field>
      <TextField
        error={errors.documentNumber}
        label="Número"
        name="documentNumber"
        onChange={onFieldChange}
        value={fields.documentNumber}
      />
    </div>
  );
}

function GuardianSection({ errors, fields, minor, onFieldChange }: StepProps): ReactElement {
  return (
    <div className="grid gap-4 border-t border-border pt-4">
      <div>
        <p className="text-control font-semibold text-foreground">Responsável</p>
        <p className="mt-0.5 text-caption text-muted-foreground">
          {minor ? "Obrigatório para alunos menores de idade." : "Opcional para adultos."}
        </p>
      </div>
      <TextField
        error={errors.guardianName}
        label="Nome do responsável"
        name="guardianName"
        onChange={onFieldChange}
        required={minor}
        value={fields.guardianName}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          error={errors.guardianPhone}
          label="Telefone do responsável"
          name="guardianPhone"
          onChange={onFieldChange}
          type="tel"
          value={fields.guardianPhone}
        />
        <TextField
          error={errors.guardianEmail}
          label="Email do responsável"
          name="guardianEmail"
          onChange={onFieldChange}
          type="email"
          value={fields.guardianEmail}
        />
      </div>
    </div>
  );
}

/** Step 1 of the wizard — the only step with real fields in this slice. */
export function DadosStep(props: StepProps): ReactElement {
  const { errors, fields, onFieldChange } = props;

  return (
    <div className="grid gap-4">
      <TextField
        error={errors.fullName}
        label="Nome completo"
        name="fullName"
        onChange={onFieldChange}
        required
        value={fields.fullName}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          error={errors.phone}
          label="Telefone"
          name="phone"
          onChange={onFieldChange}
          type="tel"
          value={fields.phone}
        />
        <TextField
          error={errors.email}
          label="Email"
          name="email"
          onChange={onFieldChange}
          type="email"
          value={fields.email}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          error={errors.birthDate}
          label="Nascimento"
          name="birthDate"
          onChange={onFieldChange}
          type="date"
          value={fields.birthDate}
        />
      </div>
      <DocumentFields {...props} />
      <GuardianSection {...props} />
    </div>
  );
}
