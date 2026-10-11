"use client";
import { useState, type FormEvent, type ReactElement } from "react";
import { Field, FieldError, Label, Textarea } from "@lazuli/ui";
import { leadContactSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { TextControl } from "~/features/classes/form-controls";
import { LeadFormDialog, useLeadErrors } from "./lead-form";
import { dateLabel, type Candidate } from "./labels";

export function LeadContactDialog({
  candidate,
  onClose,
}: {
  candidate: Candidate;
  onClose: () => void;
}): ReactElement {
  const [id] = useState(() => crypto.randomUUID());
  const [date, setDate] = useState(dateLabel(candidate.today));
  const [summary, setSummary] = useState("");
  const errors = useLeadErrors();
  const utils = trpc.useUtils();
  const save = trpc.admissions.contact.useMutation({
    onSuccess: async () => {
      await utils.admissions.invalidate();
      onClose();
    },
  });
  function submit(event: FormEvent): void {
    event.preventDefault();
    if (save.isPending) return;
    const parsed = leadContactSchema.safeParse({
      id,
      candidateId: candidate.id,
      summary,
      contactedOn: parseDateBR(date) ?? "",
    });
    if (!parsed.success) {
      errors.report(parsed.error.issues);
      return;
    }
    save.mutate(parsed.data);
  }
  return (
    <LeadFormDialog
      id="lead-contact-form"
      title="Registrar contato"
      description="Registre a conversa para que a equipe possa continuar de onde parou."
      firstField="lead-contact-date"
      body={errors.body}
      pending={save.isPending}
      error={save.error?.message}
      submitLabel="Registrar contato"
      onSubmit={submit}
      onClose={onClose}
    >
      <ContactFields
        date={date}
        summary={summary}
        errors={errors.fields}
        onDate={(value) => {
          setDate(maskDateBR(value));
          errors.clear("contactedOn");
          save.reset();
        }}
        onSummary={(value) => {
          setSummary(value);
          errors.clear("summary");
          save.reset();
        }}
      />
    </LeadFormDialog>
  );
}
export function ContactFields({
  date,
  summary,
  errors,
  onDate,
  onSummary,
}: {
  date: string;
  summary: string;
  errors: Record<string, string>;
  onDate: (value: string) => void;
  onSummary: (value: string) => void;
}): ReactElement {
  return (
    <>
      <div className="w-40">
        <TextControl
          name="lead-contact-date"
          label="Data do contato"
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          value={date}
          onChange={onDate}
          error={errors.contactedOn}
        />
      </div>
      <Field>
        <Label htmlFor="lead-contact-summary">O que foi conversado</Label>
        <Textarea
          id="lead-contact-summary"
          name="lead-contact-summary"
          autoComplete="off"
          placeholder="Ex.: conversamos com a mãe, que pediu opções no período da tarde"
          value={summary}
          onChange={(event) => onSummary(event.target.value)}
          invalid={Boolean(errors.summary)}
        />
        <FieldError match={Boolean(errors.summary)}>{errors.summary}</FieldError>
      </Field>
    </>
  );
}
