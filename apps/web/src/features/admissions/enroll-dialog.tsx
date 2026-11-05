"use client";
import { useState, type FormEvent, type ReactElement, type RefObject } from "react";
import { ToastAlert, Alert } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { useScrollToError } from "~/lib/scroll-to-error";
import { AdmissionDialog } from "./admission-dialog";
import {
  EnrollmentMode,
  ExistingEnrollmentStudent,
  NewEnrollmentStudent,
} from "./enrollment-fields";
import {
  initialEnrollmentDraft,
  enrollmentErrors,
  enrollmentStudent,
  type EnrollmentDraft,
  type EnrollmentFieldsProps,
} from "./enrollment-model";
import { dateLabel, type Candidate } from "./labels";
import type { ClassMatch } from "./matching-classes";
type EnrollmentInput = {
  candidate: Candidate;
  choice: ClassMatch;
  date: string;
  onClose: () => void;
};
type EnrollMutation = ReturnType<typeof trpc.admissions.enroll.useMutation>;
type EnrollmentFormState = {
  draft: EnrollmentDraft;
  errors: Record<string, string>;
  body: RefObject<HTMLDivElement | null>;
  mutation: EnrollMutation;
  change: EnrollmentFieldsProps["change"];
  submit: (event: FormEvent) => void;
};
function useEnrollMutation(onClose: () => void): EnrollMutation {
  const utils = trpc.useUtils();
  return trpc.admissions.enroll.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admissions.invalidate(),
        utils.classes.invalidate(),
        utils.students.invalidate(),
      ]);
      onClose();
    },
  });
}
function useEnrollmentForm({
  candidate,
  choice,
  date,
  onClose,
}: EnrollmentInput): EnrollmentFormState {
  const [draft, setDraft] = useState(() => initialEnrollmentDraft(candidate));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const body = useScrollToError(revision);
  const mutation = useEnrollMutation(onClose);
  const change = <Key extends keyof EnrollmentDraft>(
    key: Key,
    value: EnrollmentDraft[Key],
  ): void => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) =>
      key === "mode"
        ? {}
        : Object.fromEntries(Object.entries(current).filter(([field]) => field !== key)),
    );
    if (!mutation.isPending) mutation.reset();
  };
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (mutation.isPending) return;
    const next = enrollmentErrors(draft, candidate.today);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setRevision((value) => value + 1);
      return;
    }
    const student = enrollmentStudent(draft, candidate);
    if (student) mutation.mutate({ id: candidate.id, classId: choice.id, date, student });
  };
  return { draft, errors, body, mutation, change, submit };
}
export function EnrollDialog(input: EnrollmentInput): ReactElement {
  const form = useEnrollmentForm(input);
  const props = {
    draft: form.draft,
    errors: form.errors,
    change: form.change,
    today: input.candidate.today,
  };
  return (
    <AdmissionDialog
      title="Confirmar matrícula"
      description={`${input.choice.name} · Entrada em ${dateLabel(input.date)}`}
      formId="admission-enroll"
      onClose={input.onClose}
      pending={form.mutation.isPending}
      onSubmit={form.submit}
      body={form.body}
      initialFocus={() =>
        form.body.current?.querySelector<HTMLInputElement>("input:not(:disabled)") ??
        document.querySelector("#admission-enroll-submit")
      }
      submitLabel={form.mutation.isPending ? "Matriculando…" : "Confirmar matrícula"}
    >
      {!input.candidate.student && <EnrollmentMode {...props} />}
      {form.draft.mode === "existing" ? (
        <ExistingEnrollmentStudent {...props} locked={Boolean(input.candidate.student)} />
      ) : (
        <NewEnrollmentStudent {...props} />
      )}
      <Alert variant="neutral">
        A matrícula inicia o vínculo com a turma e o estágio. Contrato e cobranças são tratados
        separadamente.
      </Alert>
      {form.mutation.isError && (
        <ToastAlert variant="destructive">{form.mutation.error.message}</ToastAlert>
      )}
    </AdmissionDialog>
  );
}
