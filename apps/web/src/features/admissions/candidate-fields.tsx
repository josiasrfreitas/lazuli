"use client";
import { normalizeSearch } from "@lazuli/domain";
import { useState, type ReactElement } from "react";

import {
  Field,
  FieldError,
  FormRow,
  FormSection,
  Label,
  SearchSelect,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { maskPhoneBR } from "~/lib/masks";
import { TextControl } from "~/features/classes/form-controls";
import { StudentLink } from "./student-link";

import type { CandidateDraft, CandidateFieldsProps } from "./candidate-model";

export function CandidateContactFields(props: CandidateFieldsProps): ReactElement {
  const { draft, change } = props;
  return (
    <>
      <CandidateIdentityFields {...props} />
      <ContactContextFields {...props} />
      <StudentLink
        studentId={draft.studentId}
        name={draft.fullName}
        onChange={(value) => change("studentId", value)}
      />
      <FormSection title="O que procura">
        <FormRow columns={2}>
          <InterestChoice
            label="Modalidade"
            value={draft.scheduleType}
            options={{ REGULAR: "Regular", PERSONALIZED: "PPT" }}
            onChange={(value) => change("scheduleType", value as CandidateDraft["scheduleType"])}
          />
          <InterestChoice
            label="Formato"
            value={draft.format}
            options={{ IN_PERSON: "Presencial", ONLINE: "Online" }}
            onChange={(value) => change("format", value as CandidateDraft["format"])}
          />
        </FormRow>
      </FormSection>
    </>
  );
}
export function InterestChoice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <Field>
      <Label>{label}</Label>
      <SegmentedControl
        size="sm"
        aria-label={label}
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next);
        }}
      >
        {Object.entries(options).map(([key, text]) => (
          <SegmentedControlItem key={key} value={key}>
            {text}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </Field>
  );
}
export function CandidateIdentityFields({
  draft,
  change,
  errors,
}: CandidateFieldsProps): ReactElement {
  return (
    <FormSection title="Primeiro contato">
      <TextControl
        name="fullName"
        label="Nome completo"
        placeholder="Nome do lead"
        value={draft.fullName}
        onChange={(value) => change("fullName", value)}
        error={errors.fullName}
      />
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
          value={draft.email ?? ""}
          onChange={(value) => change("email", value)}
          error={errors.email}
        />
      </FormRow>
    </FormSection>
  );
}
function ContactContextFields({ draft, change }: CandidateFieldsProps): ReactElement {
  return (
    <FormRow columns={2}>
      <TextControl
        name="contactName"
        label="Pessoa de contato"
        value={draft.contactName ?? ""}
        onChange={(value) => change("contactName", value)}
        placeholder="Se diferente do futuro aluno"
      />
      <TextControl
        name="source"
        label="Como chegou à escola"
        value={draft.source ?? ""}
        onChange={(value) => change("source", value)}
        placeholder="Ex.: indicação de uma família"
      />
    </FormRow>
  );
}
export function CandidateCourseFields(props: CandidateFieldsProps): ReactElement {
  const { draft, change, errors } = props;
  return (
    <>
      <StageField
        value={draft.stageId}
        onChange={(value) => change("stageId", value)}
        error={errors.stageId}
      />
      <TextControl
        name="notes"
        label="Observações"
        placeholder="Preferências, contato ou orientações de material"
        value={draft.notes ?? ""}
        onChange={(value) => change("notes", value)}
      />
    </>
  );
}
function StageField({
  value,
  onChange,
  error,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string | undefined;
}): ReactElement {
  const options = trpc.classes.formOptions.useQuery();
  const [query, setQuery] = useState("");
  const stages = options.data?.stages ?? [];
  const selected = stages.find((row) => row.id === value);
  return (
    <Field>
      <Label>Estágio indicado</Label>
      <SearchSelect
        name="stageId"
        placeholder="Buscar estágio após o nivelamento"
        query={query}
        value={selected ? { id: selected.id, label: selected.name } : null}
        options={stages
          .filter((row) => normalizeSearch(row.name).includes(normalizeSearch(query)))
          .map((row) => ({ id: row.id, label: row.name }))}
        onQueryChange={setQuery}
        onSelect={(row) => {
          onChange(row.id);
          setQuery("");
        }}
        onClear={() => onChange(null)}
        openOnFocus
        invalid={Boolean(error)}
        emptyMessage="Nenhum estágio encontrado."
      />
      <p className="text-caption text-muted-foreground">
        O nivelamento é externo. Pode ser preenchido depois.
      </p>
      <FieldError match={Boolean(error)}>{error}</FieldError>
    </Field>
  );
}
