"use client";
import { useState, type ReactElement, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormRow } from "@lazuli/ui";
import { leadCaptureSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { maskPhoneBR } from "~/lib/masks";
import { TextControl } from "~/features/classes/form-controls";
import { LeadFormDialog, useLeadErrors } from "./lead-form";
import type { Candidate } from "./labels";
type Draft = {
  fullName: string;
  phone: string;
  email: string;
  contactName: string;
  source: string;
};
export function LeadCaptureDialog({
  candidate,
  onClose,
}: {
  candidate?: Candidate;
  onClose: () => void;
}): ReactElement {
  const [id] = useState(() => candidate?.id ?? crypto.randomUUID());
  const [draft, setDraft] = useState<Draft>(() => ({
    fullName: candidate?.fullName ?? "",
    phone: candidate?.phone ?? "",
    email: candidate?.email ?? "",
    contactName: candidate?.contactName ?? "",
    source: candidate?.source ?? "",
  }));
  const errors = useLeadErrors();
  const utils = trpc.useUtils();
  const router = useRouter();
  async function onSuccess(result: { id: string }): Promise<void> {
    await utils.admissions.invalidate();
    onClose();
    if (!candidate) router.push(`/interessados/${result.id}`);
  }
  const capture = trpc.admissions.capture.useMutation({ onSuccess });
  const update = trpc.admissions.details.useMutation({ onSuccess });
  const save = candidate ? update : capture;
  function submit(event: FormEvent): void {
    event.preventDefault();
    if (save.isPending) return;
    const parsed = leadCaptureSchema.safeParse({ id, ...draft });
    if (!parsed.success) {
      errors.report(parsed.error.issues);
      return;
    }
    save.mutate(parsed.data);
  }
  return (
    <LeadFormDialog
      id="lead-capture"
      title={candidate ? "Editar contato" : "Novo lead"}
      description="Comece pelo contato. Modalidade, horários e nivelamento podem ser definidos depois."
      firstField="lead-name"
      body={errors.body}
      pending={save.isPending}
      error={save.error?.message}
      submitLabel={candidate ? "Salvar contato" : "Cadastrar lead"}
      onSubmit={submit}
      onClose={onClose}
    >
      <CaptureFields
        draft={draft}
        errors={errors.fields}
        onChange={(key, value) => {
          setDraft((current) => ({ ...current, [key]: value }));
          errors.clear(key);
          save.reset();
        }}
      />
    </LeadFormDialog>
  );
}
export function CaptureFields({
  draft,
  errors,
  onChange,
}: {
  draft: Draft;
  errors: Record<string, string>;
  onChange: (key: keyof Draft, value: string) => void;
}): ReactElement {
  return (
    <>
      <TextControl
        name="lead-name"
        label="Nome do futuro aluno"
        value={draft.fullName}
        onChange={(value) => onChange("fullName", value)}
        placeholder="Nome de quem quer estudar"
        error={errors.fullName}
      />
      <FormRow columns={2}>
        <TextControl
          name="lead-phone"
          label="Telefone"
          value={draft.phone}
          onChange={(value) => onChange("phone", maskPhoneBR(value))}
          placeholder="(82) 99999-9999"
          error={errors.phone}
        />
        <TextControl
          name="lead-email"
          label="E-mail"
          value={draft.email}
          onChange={(value) => onChange("email", value)}
          placeholder="nome@exemplo.com"
          error={errors.email}
        />
      </FormRow>
      <TextControl
        name="lead-contact"
        label="Pessoa de contato (opcional)"
        value={draft.contactName}
        onChange={(value) => onChange("contactName", value)}
        placeholder="Ex.: Mariana, mãe do futuro aluno"
        error={errors.contactName}
      />
      <TextControl
        name="lead-source"
        label="Como chegou à escola (opcional)"
        value={draft.source}
        onChange={(value) => onChange("source", value)}
        placeholder="Ex.: indicação, Instagram, visita à escola"
        error={errors.source}
      />
    </>
  );
}
