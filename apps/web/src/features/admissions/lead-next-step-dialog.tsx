"use client";
import { useState, type FormEvent, type ReactElement } from "react";
import { leadNextStepSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { SelectControl, TextControl } from "~/features/classes/form-controls";
import { LeadFormDialog, useLeadErrors } from "./lead-form";
import { dateLabel, type Candidate } from "./labels";

export function LeadNextStepDialog({
  candidate,
  onClose,
}: {
  candidate: Candidate;
  onClose: () => void;
}): ReactElement {
  const [action, setAction] = useState(candidate.nextAction ?? "");
  const [date, setDate] = useState(candidate.nextActionOn ? dateLabel(candidate.nextActionOn) : "");
  const [owner, setOwner] = useState(candidate.ownerId ?? "none");
  const errors = useLeadErrors();
  const utils = trpc.useUtils();
  const owners = trpc.admissions.owners.useQuery();
  const save = trpc.admissions.nextStep.useMutation({
    onSuccess: async () => {
      await utils.admissions.invalidate();
      onClose();
    },
  });
  function submit(event: FormEvent): void {
    event.preventDefault();
    if (save.isPending) return;
    const parsed = leadNextStepSchema.safeParse({
      id: candidate.id,
      nextAction: action || null,
      nextActionOn: date ? (parseDateBR(date) ?? "") : null,
      ownerId: owner === "none" ? null : owner,
    });
    if (!parsed.success) {
      errors.report(parsed.error.issues);
      return;
    }
    save.mutate(parsed.data);
  }
  const choices = [
    { value: "none", label: "Sem responsável" },
    ...(owners.data ?? []).map((row) => ({ value: row.id, label: row.name })),
  ];
  if (candidate.owner && !choices.some((choice) => choice.value === candidate.ownerId))
    choices.push({ value: candidate.owner.id, label: `${candidate.owner.name} (indisponível)` });
  return (
    <LeadFormDialog
      id="lead-next-step"
      title="Próximo passo"
      description="Defina quem acompanha este lead e quando retomar o contato."
      firstField="lead-action"
      body={errors.body}
      pending={save.isPending}
      error={save.error?.message ?? owners.error?.message}
      submitLabel="Salvar próximo passo"
      onSubmit={submit}
      onClose={onClose}
    >
      <TextControl
        name="lead-action"
        label="O que precisa acontecer"
        placeholder="Ex.: ligar para combinar a aula experimental"
        value={action}
        onChange={(value) => {
          setAction(value);
          errors.clear("nextAction");
          save.reset();
        }}
        error={errors.fields.nextAction}
      />
      <div className="w-40">
        <TextControl
          name="lead-action-date"
          label="Data do retorno"
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          value={date}
          onChange={(value) => {
            setDate(maskDateBR(value));
            errors.clear("nextActionOn");
            save.reset();
          }}
          error={errors.fields.nextActionOn}
        />
      </div>
      <SelectControl
        name="lead-owner"
        label="Responsável pelo acompanhamento"
        value={owner}
        onChange={(value) => {
          setOwner(value);
          errors.clear("ownerId");
          save.reset();
        }}
        choices={choices}
        error={errors.fields.ownerId}
      />
      <p className="text-caption text-muted-foreground">
        Para retirar o retorno da fila, deixe o próximo passo e a data vazios.
      </p>
    </LeadFormDialog>
  );
}
