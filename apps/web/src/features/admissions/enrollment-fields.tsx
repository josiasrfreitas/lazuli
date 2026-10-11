"use client";
import type { ReactElement } from "react";
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
import { TextControl } from "~/features/classes/form-controls";
import { maskDateBR, maskPhoneBR } from "~/lib/masks";
import { enrollmentMinor, type EnrollmentFieldsProps } from "./enrollment-model";
export function EnrollmentMode({ draft, change }: EnrollmentFieldsProps): ReactElement {
  return (
    <SegmentedControl
      size="sm"
      aria-label="Cadastro do aluno"
      value={draft.mode}
      onValueChange={(value) => {
        if (value === "create" || value === "existing") change("mode", value);
      }}
    >
      <SegmentedControlItem value="create">Novo aluno</SegmentedControlItem>
      <SegmentedControlItem value="existing">Já cadastrado</SegmentedControlItem>
    </SegmentedControl>
  );
}
export function ExistingEnrollmentStudent({
  draft,
  change,
  errors,
  locked,
}: EnrollmentFieldsProps & { locked: boolean }): ReactElement {
  const results = trpc.students.search.useQuery(
    { query: draft.search || draft.name || " " },
    { enabled: !locked },
  );
  return (
    <Field>
      <Label>Aluno</Label>
      <SearchSelect
        name="student"
        placeholder="Buscar aluno pelo nome"
        query={draft.search}
        value={draft.student}
        options={(results.data ?? []).map((row) => ({ id: row.id, label: row.fullName }))}
        loading={results.isFetching}
        failed={results.isError}
        onQueryChange={(value) => change("search", value)}
        onSelect={(value) => change("student", value)}
        onClear={() => change("student", null)}
        invalid={Boolean(errors.student)}
        disabled={locked}
        openOnFocus
      />
      <FieldError match={Boolean(errors.student)}>{errors.student}</FieldError>
    </Field>
  );
}
export function NewEnrollmentStudent(props: EnrollmentFieldsProps): ReactElement {
  const { draft, change, errors } = props;
  return (
    <>
      <FormSection title="Cadastro do aluno">
        <TextControl
          name="name"
          label="Nome completo"
          placeholder="Nome completo do aluno"
          value={draft.name}
          onChange={(value) => change("name", value)}
          error={errors.name}
        />
        <div className="w-44">
          <TextControl
            name="birthDate"
            label="Data de nascimento"
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            value={draft.birthDate}
            onChange={(value) => change("birthDate", maskDateBR(value))}
            error={errors.birthDate}
          />
        </div>
        <p className="text-caption text-muted-foreground">
          Telefone e e-mail serão aproveitados do lead.
        </p>
      </FormSection>
      {enrollmentMinor(draft, props.today) && <EnrollmentGuardian {...props} />}
    </>
  );
}
function EnrollmentGuardian({ draft, change, errors }: EnrollmentFieldsProps): ReactElement {
  return (
    <FormSection title="Responsável pelo menor">
      <FormRow columns={2}>
        <TextControl
          name="guardianName"
          label="Nome do responsável"
          placeholder="Nome completo"
          value={draft.guardianName}
          onChange={(value) => change("guardianName", value)}
          error={errors.guardianName}
        />
        <TextControl
          name="guardianPhone"
          label="Telefone do responsável"
          placeholder="(11) 99999-9999"
          inputMode="tel"
          value={draft.guardianPhone}
          onChange={(value) => change("guardianPhone", maskPhoneBR(value))}
          error={errors.guardianPhone}
        />
      </FormRow>
    </FormSection>
  );
}
