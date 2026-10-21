"use client";
import { normalizeSearch } from "@lazuli/domain";
import { useState, type ReactElement } from "react";
import { Plus, X } from "lucide-react";
import {
  Button,
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
import { maskDateBR, maskPhoneBR, maskTime24 } from "~/lib/masks";
import { SelectControl, TextControl } from "~/features/classes/form-controls";
import { StudentLink } from "./student-link";
import { weekdays } from "./labels";
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
export function CandidateAvailabilityFields(props: CandidateFieldsProps): ReactElement {
  const { draft, change, errors } = props;
  return (
    <>
      <StageField
        value={draft.stageId}
        onChange={(value) => change("stageId", value)}
        error={errors.stageId}
      />
      <WeeklyAvailability {...props} />
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
function WeeklyAvailability(props: CandidateFieldsProps): ReactElement {
  const { draft, change, errors } = props;
  return (
    <FormSection
      title="Disponibilidade semanal"
      action={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            change("availability", [
              ...draft.availability,
              { weekday: "MONDAY", startTime: "", endTime: "" },
            ])
          }
        >
          <Plus />
          Horário
        </Button>
      }
    >
      <p className="text-caption text-muted-foreground">
        Informe os períodos em que a pessoa pode estudar.
      </p>
      <AvailabilityRows {...props} />
      <div className="max-w-48">
        <TextControl
          name="availableUntil"
          label="Horários confirmados até"
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          value={draft.availableUntil}
          onChange={(value) => change("availableUntil", maskDateBR(value))}
          error={errors.availableUntil}
        />
      </div>
    </FormSection>
  );
}
function AvailabilityRows({ draft, change, errors }: CandidateFieldsProps): ReactElement {
  return (
    <>
      {draft.availability.map((slot, index) => (
        <AvailabilityRow
          key={index}
          index={index}
          slot={slot}
          errors={errors}
          onChange={(value) =>
            change(
              "availability",
              draft.availability.map((item, position) => (position === index ? value : item)),
            )
          }
          onRemove={
            draft.availability.length > 1
              ? () =>
                  change(
                    "availability",
                    draft.availability.filter((_unused, position) => position !== index),
                  )
              : undefined
          }
        />
      ))}
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
type AvailabilityRowProps = {
  slot: CandidateDraft["availability"][number];
  index: number;
  errors: Record<string, string>;
  onChange: (value: CandidateDraft["availability"][number]) => void;
  onRemove?: (() => void) | undefined;
};
export function AvailabilityRow({
  slot,
  index,
  errors,
  onChange,
  onRemove,
}: AvailabilityRowProps): ReactElement {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_5rem_5rem_auto] items-end gap-2">
      <SelectControl
        name={`availability.${index}.weekday`}
        label="Dia"
        value={slot.weekday}
        choices={weekdays}
        onChange={(value) => onChange({ ...slot, weekday: value as typeof slot.weekday })}
      />
      <TextControl
        name={`availability.${index}.startTime`}
        label="Das"
        placeholder="08:00"
        inputMode="numeric"
        value={slot.startTime}
        onChange={(value) => onChange({ ...slot, startTime: maskTime24(value) })}
        error={errors[`availability.${index}.startTime`]}
      />
      <TextControl
        name={`availability.${index}.endTime`}
        label="Até"
        placeholder="12:00"
        inputMode="numeric"
        value={slot.endTime}
        onChange={(value) => onChange({ ...slot, endTime: maskTime24(value) })}
        error={errors[`availability.${index}.endTime`]}
      />
      {onRemove && (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Remover horário ${index + 1}`}
          onClick={onRemove}
        >
          <X />
        </Button>
      )}
    </div>
  );
}
