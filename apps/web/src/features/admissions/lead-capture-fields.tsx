import type { ReactElement } from "react";
import { MessageSquare } from "lucide-react";
import { Field, FieldError, FormRow, FormSection, Label, Textarea } from "@lazuli/ui";
import type { leadCaptureSchema, z } from "@lazuli/validators";
import { maskDateBR, maskPhoneBR } from "~/lib/masks";
import { TextControl } from "~/features/classes/form-controls";
import { InterestChoice } from "./candidate-fields";
export type Draft = Omit<z.infer<typeof leadCaptureSchema>, "id" | "birthDate"> & {
  birthDate: string;
};
type Props = {
  draft: Draft;
  errors: Record<string, string>;
  change: <Key extends keyof Draft>(key: Key, value: Draft[Key]) => void;
};
export function LeadCaptureContactFields(props: Props): ReactElement {
  return (
    <FormSection title="Aluno e contato">
      <LeadIdentityFields {...props} />
      <LeadContactChannels {...props} />
      <LeadProfileFields {...props} />
    </FormSection>
  );
}
function LeadIdentityFields({ draft, errors, change }: Props): ReactElement {
  return (
    <>
      {" "}
      <InterestChoice
        label="Quem está entrando em contato?"
        value={draft.contactRole}
        options={{ STUDENT: "Próprio aluno · maior", GUARDIAN: "Responsável · menor" }}
        onChange={(value) => {
          change("contactRole", value as Draft["contactRole"]);
          change("contactOwner", value as Draft["contactOwner"]);
          if (value === "STUDENT") change("contactName", "");
        }}
      />
      <TextControl
        name="lead-name"
        label="Nome do aluno"
        placeholder="Nome completo do aluno"
        value={draft.fullName}
        onChange={(value) => change("fullName", value)}
        error={errors.fullName}
      />
      {draft.contactRole === "GUARDIAN" && (
        <>
          <TextControl
            name="contactName"
            label="Nome do responsável"
            placeholder="Nome completo do responsável"
            value={draft.contactName ?? ""}
            onChange={(value) => change("contactName", value)}
            error={errors.contactName}
          />
          <InterestChoice
            label="De quem é o contato abaixo?"
            value={draft.contactOwner}
            options={{ GUARDIAN: "Responsável", STUDENT: "Aluno" }}
            onChange={(value) => change("contactOwner", value as Draft["contactOwner"])}
          />
        </>
      )}
    </>
  );
}
function LeadContactChannels({ draft, errors, change }: Props): ReactElement {
  return (
    <FormRow columns={2}>
      <TextControl
        name="phone"
        label="Telefone"
        placeholder="(11) 99999-9999"
        inputMode="tel"
        value={draft.phone ?? ""}
        onChange={(value) => change("phone", maskPhoneBR(value))}
        error={errors.phone}
      />
      <TextControl
        name="email"
        label="E-mail"
        placeholder="nome@exemplo.com"
        inputMode="email"
        value={draft.email ?? ""}
        onChange={(value) => change("email", value)}
        error={errors.email}
      />
    </FormRow>
  );
}
function LeadProfileFields({ draft, errors, change }: Props): ReactElement {
  return (
    <>
      {" "}
      <div className="w-40">
        <TextControl
          name="birthDate"
          label="Nascimento (opcional)"
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          value={draft.birthDate}
          onChange={(value) => change("birthDate", maskDateBR(value))}
          error={errors.birthDate}
        />
      </div>
      <TextControl
        name="source"
        label="Como chegou à escola"
        value={draft.source ?? ""}
        onChange={(value) => change("source", value)}
        placeholder="Indicação, Instagram…"
      />
    </>
  );
}
export function LeadCaptureNotesField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}): ReactElement {
  return (
    <Field name="notes">
      <Label htmlFor="lead-notes">
        <span className="inline-flex items-center gap-1.5">
          <MessageSquare className="size-3.5" aria-hidden="true" />
          Observações (opcional)
        </span>
      </Label>
      <Textarea
        id="lead-notes"
        name="notes"
        autoComplete="off"
        rows={4}
        maxLength={2000}
        placeholder="Objetivos com o inglês, preferências ou informações do primeiro contato"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        invalid={Boolean(error)}
        aria-describedby={error ? "lead-notes-error" : undefined}
      />
      {error && (
        <FieldError id="lead-notes-error" match>
          {error}
        </FieldError>
      )}
    </Field>
  );
}
