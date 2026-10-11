"use client";
import { useState, type ReactElement } from "react";
import { FormSection } from "@lazuli/ui";
import { z } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { SelectControl } from "~/features/classes/form-controls";
import { FollowUpDialog, useValidation } from "./form-parts";
import { dateLabel, QueryState } from "./shared";
export function LinkOccurrenceForm({
  studentId,
  target,
  exclude,
  onClose,
}: {
  studentId: string;
  target:
    | { type: "occurrence"; id: string }
    | { type: "intervention"; id: string; version: number };
  exclude: string[];
  onClose: () => void;
}): ReactElement {
  const [selected, setSelected] = useState("");
  const validation = useValidation();
  const rows = trpc.occurrences.forStudent.useQuery({ studentId });
  const utils = trpc.useUtils();
  const onSuccess = async (): Promise<void> => {
    await Promise.all([utils.occurrences.invalidate(), utils.interventions.invalidate()]);
    onClose();
  };
  const occurrence = trpc.occurrences.link.useMutation({ onSuccess });
  const intervention = trpc.interventions.link.useMutation({ onSuccess });
  const pending = occurrence.isPending || intervention.isPending;
  const choices = (rows.data ?? []).filter((row) => !exclude.includes(row.id));
  return (
    <FollowUpDialog
      title={
        target.type === "occurrence" ? "Relacionar ocorrências" : "Incluir ocorrência motivadora"
      }
      description="Selecione outro relato deste aluno para manter o contexto conectado."
      formId="link-occurrence"
      firstField="related-occurrence"
      submitLabel="Relacionar ocorrência"
      pending={pending}
      onClose={onClose}
      error={occurrence.error?.message ?? intervention.error?.message}
      bodyRef={validation.body}
    >
      <QueryState pending={rows.isPending} error={rows.error} retry={() => void rows.refetch()} />
      <form
        id="link-occurrence"
        noValidate
        className="grid gap-4 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          if (
            !validation.validate(z.object({ id: z.string().uuid("Selecione uma ocorrência.") }), {
              id: selected,
            })
          )
            return;
          if (target.type === "occurrence")
            occurrence.mutate({ occurrenceId: target.id, relatedId: selected });
          else
            intervention.mutate({ id: target.id, version: target.version, occurrenceId: selected });
        }}
      >
        <FormSection title="Relatos do aluno">
          <SelectControl
            name="related-occurrence"
            label="Ocorrência"
            value={selected}
            onChange={(value) => {
              setSelected(value);
              validation.clear("id");
              occurrence.reset();
              intervention.reset();
            }}
            choices={choices.map((row) => ({
              value: row.id,
              label: `${dateLabel(row.classSession.date)} · ${row.title}`,
            }))}
            error={validation.errors.id}
          />
          {rows.data && !choices.length && (
            <p className="text-caption text-muted-foreground">
              Todos os relatos disponíveis já estão relacionados.
            </p>
          )}
        </FormSection>
      </form>
    </FollowUpDialog>
  );
}
