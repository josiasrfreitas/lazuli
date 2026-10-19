"use client";
import { useState, type ReactElement } from "react";
import { occurrenceUpdateSchema, interventionFollowUpSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { type Intervention, type Occurrence } from "./shared";
import { TaskDialog, NarrativeField, useValidation } from "~/features/shared/task-form";
export function OccurrenceEditForm({
  row,
  onClose,
}: {
  row: Occurrence;
  onClose: () => void;
}): ReactElement {
  const [account, setAccount] = useState(row.account);
  const [expectedUpdatedAt] = useState(row.updatedAt);
  const validation = useValidation();
  const utils = trpc.useUtils();
  const save = trpc.occurrences.update.useMutation({
    onSuccess: async () => {
      await utils.occurrences.invalidate();
      onClose();
    },
  });
  return (
    <TaskDialog
      title="Editar relato"
      description="Atualize o que aconteceu nesta ocorrência."
      formId="occurrence-edit"
      firstField="occurrence-account"
      submitLabel="Salvar relato"
      onClose={onClose}
      pending={save.isPending}
      error={save.error?.message}
      bodyRef={validation.body}
    >
      <form
        id="occurrence-edit"
        noValidate
        className="grid gap-4 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (save.isPending) return;
          const parsed = validation.validate(occurrenceUpdateSchema, {
            id: row.id,
            account,
            expectedUpdatedAt,
          });
          if (parsed) save.mutate(parsed);
        }}
      >
        <NarrativeField
          name="occurrence-account"
          label="O que aconteceu?"
          value={account}
          placeholder="Descreva os fatos observados e o contexto da atividade."
          onChange={(value) => {
            setAccount(value);
            validation.clear("account");
            save.reset();
          }}
          error={validation.errors.account}
        />
      </form>
    </TaskDialog>
  );
}
export function InterventionFollowUpForm({
  row,
  onClose,
}: {
  row: Intervention;
  onClose: () => void;
}): ReactElement {
  const [body, setBody] = useState("");
  const [version] = useState(row.version);
  const validation = useValidation();
  const utils = trpc.useUtils();
  const save = trpc.interventions.followUp.useMutation({
    onSuccess: async () => {
      await utils.interventions.invalidate();
      onClose();
    },
  });
  return (
    <TaskDialog
      title="Registrar evolução"
      description={row.student.fullName}
      formId="intervention-follow-up"
      firstField="follow-up-body"
      submitLabel="Salvar evolução"
      onClose={onClose}
      pending={save.isPending}
      error={save.error?.message}
      bodyRef={validation.body}
    >
      <form
        id="intervention-follow-up"
        noValidate
        className="grid gap-4 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (save.isPending) return;
          const parsed = validation.validate(interventionFollowUpSchema, {
            id: row.id,
            version,
            body,
          });
          if (parsed) save.mutate(parsed);
        }}
      >
        <NarrativeField
          name="follow-up-body"
          label="O que foi feito ou observado?"
          placeholder="Registre o contato, a ação ou a observação posterior à tratativa."
          value={body}
          onChange={(value) => {
            setBody(value);
            validation.clear("body");
            save.reset();
          }}
          error={validation.errors.body}
        />
      </form>
    </TaskDialog>
  );
}
