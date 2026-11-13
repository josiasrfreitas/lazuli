import type { ReactElement } from "react";
import {
  FormRow,
  FormSection,
  Field,
  Label,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { ReferenceFields } from "~/features/shared/reference-fields";
import { TextControl } from "~/features/classes/form-controls";
import { NarrativeField } from "~/features/shared/task-form";
import { maskDateBR } from "~/lib/masks";
import { KIND_LABELS } from "./shared";
export type WindowDraft = {
  plannedStartOn: string;
  plannedEndOn: string;
  objective: string;
  reason: string;
};
export type ItemDraft = {
  plannedOn: string;
  kind: keyof typeof KIND_LABELS;
  title: string;
  reference: string;
  pageFrom: string;
  pageTo: string;
  reason: string;
};
export function PlanDateField({
  name,
  label,
  value,
  onChange,
  error,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}): ReactElement {
  return (
    <div className="w-40">
      <TextControl
        name={name}
        label={label}
        placeholder="dd/mm/aaaa"
        value={value}
        inputMode="numeric"
        onChange={(next) => onChange(maskDateBR(next))}
        error={error}
      />
    </div>
  );
}
export function RevisionReason({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}): ReactElement {
  return (
    <NarrativeField
      name="reason"
      label="Motivo da revisão"
      value={value}
      onChange={onChange}
      error={error}
      placeholder="Ex.: reservar mais um encontro para prática oral"
    />
  );
}
export function WindowFields({
  values,
  errors,
  editing,
  change,
}: {
  values: WindowDraft;
  errors: Record<string, string>;
  editing: boolean;
  change: (key: keyof WindowDraft, value: string) => void;
}): ReactElement {
  return (
    <FormSection title="Calendário da programação">
      <FormRow columns={2} className="w-fit">
        <PlanDateField
          name="plannedStartOn"
          label="Início planejado"
          value={values.plannedStartOn}
          onChange={(value) => change("plannedStartOn", value)}
          error={errors.plannedStartOn}
        />
        <div className="grid content-center gap-1 text-caption text-muted-foreground">
          <span>Término do semestre</span>
          <strong>{values.plannedEndOn}</strong>
        </div>
      </FormRow>
      {editing && (
        <RevisionReason
          value={values.reason}
          onChange={(value) => change("reason", value)}
          error={errors.reason}
        />
      )}
    </FormSection>
  );
}
export function ItemFields({
  values,
  errors,
  editing,
  change,
}: {
  values: ItemDraft;
  errors: Record<string, string>;
  editing: boolean;
  change: (key: keyof ItemDraft, value: string) => void;
}): ReactElement {
  return (
    <FormSection title="Atividade e data prevista">
      <PlanDateField
        name="plannedOn"
        label="Data prevista"
        value={values.plannedOn}
        onChange={(value) => change("plannedOn", value)}
        error={errors.plannedOn}
      />
      <ActivityKind values={values} change={change} />
      <TextControl
        name="title"
        label="Atividade planejada"
        placeholder="Ex.: entrevistas em duplas sobre a rotina"
        value={values.title}
        onChange={(value) => change("title", value)}
        error={errors.title}
      />
      <ReferenceFields value={values} errors={errors} change={change} />
      {editing && (
        <RevisionReason
          value={values.reason}
          onChange={(value) => change("reason", value)}
          error={errors.reason}
        />
      )}
    </FormSection>
  );
}

function ActivityKind({
  values,
  change,
}: {
  values: ItemDraft;
  change: (key: keyof ItemDraft, next: string) => void;
}): ReactElement {
  return (
    <Field>
      <Label id="activity-kind-label">Tipo de atividade</Label>
      <div className="min-w-0">
        <SegmentedControl
          size="sm"
          wrap
          aria-labelledby="activity-kind-label"
          value={values.kind}
          onValueChange={(value) => {
            if (value) change("kind", value);
          }}
        >
          {Object.entries(KIND_LABELS).map(([kind, label]) => (
            <SegmentedControlItem key={kind} value={kind}>
              {label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>
    </Field>
  );
}
