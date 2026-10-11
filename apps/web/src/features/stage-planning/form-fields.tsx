import type { ReactElement } from "react";
import { Field, Label, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
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
    <>
      <div className="flex flex-wrap items-start gap-3">
        <PlanDateField
          name="plannedStartOn"
          label="Início planejado"
          value={values.plannedStartOn}
          onChange={(value) => change("plannedStartOn", value)}
          error={errors.plannedStartOn}
        />
        <PlanDateField
          name="plannedEndOn"
          label="Prazo do estágio"
          value={values.plannedEndOn}
          onChange={(value) => change("plannedEndOn", value)}
          error={errors.plannedEndOn}
        />
      </div>
      <NarrativeField
        name="objective"
        label="Objetivo do plano · opcional"
        value={values.objective}
        onChange={(value) => change("objective", value)}
        error={errors.objective}
        placeholder="Ex.: ampliar a autonomia em conversas sobre o dia a dia"
      />
      {editing && (
        <RevisionReason
          value={values.reason}
          onChange={(value) => change("reason", value)}
          error={errors.reason}
        />
      )}
    </>
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
    <>
      <PlanDateField
        name="plannedOn"
        label="Data prevista"
        value={values.plannedOn}
        onChange={(value) => change("plannedOn", value)}
        error={errors.plannedOn}
      />
      <Field>
        <Label id="activity-kind-label">Tipo de atividade</Label>
        <div className="overflow-x-auto">
          <SegmentedControl
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
      <TextControl
        name="title"
        label="Atividade planejada"
        placeholder="Ex.: entrevistas em duplas sobre a rotina"
        value={values.title}
        onChange={(value) => change("title", value)}
        error={errors.title}
      />
      <details
        className="rounded-md border border-border p-3"
        open={
          Boolean(
            values.reference ||
            values.pageFrom ||
            values.pageTo ||
            errors.reference ||
            errors.pageFrom ||
            errors.pageTo,
          ) || undefined
        }
      >
        <summary className="cursor-pointer text-caption font-medium">
          Lição e páginas · opcionais
        </summary>
        <div className="mt-3 grid gap-3">
          <TextControl
            name="reference"
            label="Lição ou referência"
            placeholder="Ex.: Unit 3 · Student’s Book"
            value={values.reference}
            onChange={(value) => change("reference", value)}
            error={errors.reference}
          />
          <div className="flex flex-wrap gap-3">
            {(["pageFrom", "pageTo"] as const).map((name) => (
              <div className="w-28" key={name}>
                <TextControl
                  name={name}
                  label={name === "pageFrom" ? "Página inicial" : "Página final"}
                  placeholder={name === "pageFrom" ? "Ex.: 24" : "Ex.: 27"}
                  inputMode="numeric"
                  value={values[name]}
                  onChange={(value) => change(name, value)}
                  error={errors[name]}
                />
              </div>
            ))}
          </div>
        </div>
      </details>
      {editing && (
        <RevisionReason
          value={values.reason}
          onChange={(value) => change("reason", value)}
          error={errors.reason}
        />
      )}
    </>
  );
}
