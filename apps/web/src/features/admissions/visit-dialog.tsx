"use client";
import type { ReactElement } from "react";
import { Alert } from "@lazuli/ui";
import { TextControl } from "~/features/classes/form-controls";
import { AdmissionDialog } from "./admission-dialog";
import {
  VisitKindField,
  VisitDateField,
  TrialVisitFields,
  IntroductoryVisitFields,
} from "./visit-fields";
import { visitSubmitLabel } from "./visit-model";
import { useVisitForm, type VisitInput } from "./use-visit-form";
export function VisitDialog(input: VisitInput): ReactElement {
  const form = useVisitForm(input);
  const props = { draft: form.draft, change: form.change, errors: form.validation.errors };
  return (
    <AdmissionDialog
      title={input.previousVisitId ? "Remarcar aula de entrada" : "Agendar aula de entrada"}
      description={input.candidate.fullName}
      formId="entry-visit-form"
      onClose={input.onClose}
      backLabel="Cancelar"
      body={form.validation.body}
      initialFocus={() => form.validation.body.current?.querySelector("input") ?? false}
      pending={form.mutation.isPending}
      onSubmit={form.submit}
      submitLabel={visitSubmitLabel(form.mutation.isPending, Boolean(input.previousVisitId))}
    >
      <VisitKindField {...props} />
      <VisitDateField {...props} />
      {form.draft.kind === "TRIAL" ? (
        <TrialVisitFields {...props} options={form.options} />
      ) : (
        <IntroductoryVisitFields
          {...props}
          date={form.options.parsedDate ?? input.candidate.today}
          online={input.candidate.format === "ONLINE"}
        />
      )}
      <TextControl
        name="notes"
        label="Orientações e material"
        placeholder="O que preparar ou levar para a aula"
        value={form.draft.notes}
        onChange={(value) => form.change("notes", value)}
        error={form.validation.errors.notes}
      />
      {input.previousVisitId && (
        <Alert variant="neutral">O agendamento anterior será preservado como remarcado.</Alert>
      )}
      {form.mutation.isError && <Alert variant="destructive">{form.mutation.error.message}</Alert>}
    </AdmissionDialog>
  );
}
