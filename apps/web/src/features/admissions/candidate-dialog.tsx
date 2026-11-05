"use client";
import { useState, type ReactElement } from "react";
import { ToastAlert } from "@lazuli/ui";
import { AdmissionDialog } from "./admission-dialog";
import { CandidateContactFields, CandidateCourseFields } from "./candidate-fields";
import { candidateSubmitLabel } from "./candidate-model";
import { useCandidateForm, useCandidateSave } from "./use-candidate-form";
import type { Candidate } from "./labels";
type CandidateDialogProps = {
  candidate?: Candidate;
  startAtCourse?: boolean;
  onClose: () => void;
};
export function CandidateDialog({
  candidate,
  onClose,
  startAtCourse = false,
}: CandidateDialogProps): ReactElement {
  const [id] = useState(() => candidate?.id ?? crypto.randomUUID());
  const form = useCandidateForm(candidate, startAtCourse);
  const save = useCandidateSave({ id, editing: Boolean(candidate), onClose });
  const change: typeof form.change = (key, value) => {
    form.change(key, value);
    if (!save.isPending) save.reset();
  };
  return (
    <AdmissionDialog
      title={candidate ? "Editar lead" : "Novo lead"}
      description={form.step === 0 ? "1 de 2 · Pessoa e interesse" : "2 de 2 · Curso e nivelamento"}
      formId="candidate-form"
      body={form.body}
      pending={save.isPending}
      onClose={onClose}
      initialFocus={() => form.body.current?.querySelector("input") ?? false}
      backLabel={form.step === 1 ? "Voltar" : "Cancelar"}
      onBack={() => (form.step === 1 ? form.setStep(0) : onClose())}
      submitLabel={candidateSubmitLabel(save.isPending, {
        step: form.step,
        editing: Boolean(candidate),
      })}
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
        <CandidateCourseFields draft={form.draft} errors={form.errors} change={change} />
      )}
      {save.isError && <ToastAlert variant="destructive">{save.error.message}</ToastAlert>}
    </AdmissionDialog>
  );
}
