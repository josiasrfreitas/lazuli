"use client";
import { useState, type ReactElement } from "react";
import { Alert } from "@lazuli/ui";
import { AdmissionDialog } from "./admission-dialog";
import { CandidateContactFields, CandidateAvailabilityFields } from "./candidate-fields";
import { candidateSubmitLabel } from "./candidate-model";
import { useCandidateForm, useCandidateSave } from "./use-candidate-form";
import type { Candidate } from "./labels";
type CandidateDialogProps = {
  candidate?: Candidate;
  startAtAvailability?: boolean;
  onClose: () => void;
};
export function CandidateDialog({
  candidate,
  onClose,
  startAtAvailability = false,
}: CandidateDialogProps): ReactElement {
  const [id] = useState(() => candidate?.id ?? crypto.randomUUID());
  const form = useCandidateForm(candidate, startAtAvailability);
  const save = useCandidateSave(id, Boolean(candidate), onClose);
  const change: typeof form.change = (key, value) => {
    form.change(key, value);
    if (!save.isPending) save.reset();
  };
  return (
    <AdmissionDialog
      title={candidate ? "Editar lead" : "Novo lead"}
      description={
        form.step === 0 ? "1 de 2 · Pessoa e interesse" : "2 de 2 · Horários e nivelamento"
      }
      formId="candidate-form"
      body={form.body}
      pending={save.isPending}
      onClose={onClose}
      initialFocus={() => form.body.current?.querySelector("input") ?? false}
      backLabel={form.step === 1 ? "Voltar" : "Cancelar"}
      onBack={() => (form.step === 1 ? form.setStep(0) : onClose())}
      submitLabel={candidateSubmitLabel(save.isPending, form.step, Boolean(candidate))}
      onSubmit={(event) => {
        event.preventDefault();
        if (save.isPending) return;
        const values = form.validate();
        if (values) save.mutate({ id, values });
      }}
    >
      {form.step === 0 ? (
        <CandidateContactFields draft={form.draft} errors={form.errors} change={change} />
      ) : (
        <CandidateAvailabilityFields draft={form.draft} errors={form.errors} change={change} />
      )}
      {save.isError && <Alert variant="destructive">{save.error.message}</Alert>}
    </AdmissionDialog>
  );
}
