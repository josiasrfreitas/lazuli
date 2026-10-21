"use client";
import type { ReactElement } from "react";
import { FormRow, FormSection } from "@lazuli/ui";
import { CalendarDays, FileText, MessageSquare, UserRound } from "lucide-react";
import { SelectControl, TextControl } from "~/features/classes/form-controls";
import { maskDateBR } from "~/lib/masks";
import { NarrativeField } from "~/features/shared/task-form";

import { FormFieldLoading } from "./form-field-loading";
export { MotivatingOccurrenceFields } from "./intervention-occurrences";

type Fields = { title: string; responsibleId: string; performedOn: string; treatment: string };
export function InterventionFields({
  values,
  change,
  errors,
  staff,
  staffLoading = false,
  responsibleHint,
}: {
  values: Fields;
  change: (name: keyof Fields, value: string) => void;
  errors: Record<string, string>;
  staff: { id: string; name: string }[];
  staffLoading?: boolean;
  responsibleHint?: string | undefined;
}): ReactElement {
  return (
    <FormSection title="Tratativa realizada">
      <TextControl
        name="intervention-title"
        label="Descrição"
        labelIcon={<FileText aria-hidden="true" className="size-3.5 text-muted-foreground" />}
        value={values.title}
        onChange={(value) => change("title", value)}
        placeholder="Ex.: Conversa sobre participação nas aulas"
        error={errors.title}
      />
      <NarrativeField
        name="treatment"
        label="O que foi feito?"
        labelIcon={<MessageSquare aria-hidden="true" className="size-3.5 text-muted-foreground" />}
        value={values.treatment}
        onChange={(value) => change("treatment", value)}
        placeholder="Descreva a conversa, orientação ou ação realizada."
        error={errors.treatment}
        rows={6}
      />
      <FormRow columns={2}>
        <div className="grid min-w-0 gap-1.5">
          {staffLoading ? (
            <FormFieldLoading label="Responsável" />
          ) : (
            <SelectControl
              name="responsibleId"
              label="Responsável"
              labelIcon={
                <UserRound aria-hidden="true" className="size-3.5 text-muted-foreground" />
              }
              value={values.responsibleId}
              onChange={(value) => change("responsibleId", value)}
              choices={staff.map((row) => ({ value: row.id, label: row.name }))}
              error={errors.responsibleId}
            />
          )}
          {responsibleHint && (
            <p className="text-caption text-muted-foreground">{responsibleHint}</p>
          )}
        </div>
        <TextControl
          name="performedOn"
          label="Data da tratativa"
          labelIcon={<CalendarDays aria-hidden="true" className="size-3.5 text-muted-foreground" />}
          value={values.performedOn}
          onChange={(value) => change("performedOn", maskDateBR(value))}
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          error={errors.performedOn}
        />
      </FormRow>
    </FormSection>
  );
}
