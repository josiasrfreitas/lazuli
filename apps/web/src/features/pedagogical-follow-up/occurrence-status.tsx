"use client";
import { useState, type ReactElement } from "react";
import { Badge, Button } from "@lazuli/ui";
import { occurrenceStatusChangeSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { TaskDialog, NarrativeField, useValidation } from "~/features/shared/task-form";
import { OCCURRENCE_STATUS, recordedLabel, type Occurrence } from "./shared";
import styles from "./student-desk.module.css";

export function OccurrenceStatus({ row }: { row: Occurrence }): ReactElement {
  const [closing, setClosing] = useState(false);
  const utils = trpc.useUtils();
  async function refresh(): Promise<void> {
    await Promise.all([utils.occurrences.invalidate(), utils.dashboard.invalidate()]);
  }
  const save = trpc.occurrences.changeStatus.useMutation({ onSuccess: refresh });
  return (
    <section className={styles.occurrenceSection}>
      <div className={styles.sectionHeading}>
        <h4>Estado da ocorrência</h4>
        <Badge variant="neutral">{OCCURRENCE_STATUS[row.status]}</Badge>
      </div>
      {row.canOrganize && (
        <div className="flex flex-wrap items-center gap-2">
          {row.status !== "FOLLOWING_UP" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={save.isPending}
              onClick={() =>
                save.mutate({
                  id: row.id,
                  expectedVersion: row.statusVersion,
                  status: "FOLLOWING_UP",
                  conclusion: "",
                })
              }
            >
              {row.status === "CLOSED" ? "Reabrir acompanhamento" : "Iniciar acompanhamento"}
            </Button>
          )}
          {row.status !== "CLOSED" && (
            <Button
              size="sm"
              variant="text"
              disabled={save.isPending}
              onClick={() => setClosing(true)}
            >
              Encerrar ocorrência
            </Button>
          )}
        </div>
      )}
      {save.error && <p role="alert">{save.error.message}</p>}
      <small>
        Aberta por {row.recordedBy.name} · {recordedLabel(row.createdAt)}
      </small>
      {row.statusChanges.map((change) => (
        <div key={change.id}>
          <small>
            {OCCURRENCE_STATUS[change.fromStatus]} → {OCCURRENCE_STATUS[change.toStatus]}
            {" · "}
            {change.author.name} · {recordedLabel(change.createdAt)}
          </small>
          {change.conclusion && <p>{change.conclusion}</p>}
        </div>
      ))}
      {closing && <CloseOccurrence row={row} onClose={() => setClosing(false)} refresh={refresh} />}
    </section>
  );
}

function CloseOccurrence({
  row,
  onClose,
  refresh,
}: {
  row: Occurrence;
  onClose: () => void;
  refresh: () => Promise<void>;
}): ReactElement {
  const [conclusion, setConclusion] = useState("");
  const [expectedVersion] = useState(row.statusVersion);
  const validation = useValidation();
  const save = trpc.occurrences.changeStatus.useMutation({
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  return (
    <TaskDialog
      title="Encerrar ocorrência"
      description="Registre a conclusão. A ocorrência sairá das pendências e continuará no histórico do aluno."
      formId="occurrence-close"
      firstField="occurrence-conclusion"
      submitLabel="Encerrar ocorrência"
      onClose={onClose}
      pending={save.isPending}
      error={save.error?.message}
      bodyRef={validation.body}
    >
      <form
        id="occurrence-close"
        noValidate
        className="grid gap-4 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (save.isPending) return;
          const parsed = validation.validate(occurrenceStatusChangeSchema, {
            id: row.id,
            expectedVersion,
            status: "CLOSED",
            conclusion,
          });
          if (parsed) save.mutate(parsed);
        }}
      >
        <NarrativeField
          name="occurrence-conclusion"
          label="Conclusão"
          value={conclusion}
          placeholder="Descreva como a ocorrência foi concluída."
          error={validation.errors.conclusion}
          onChange={(value) => {
            setConclusion(value);
            validation.clear("conclusion");
            save.reset();
          }}
        />
      </form>
    </TaskDialog>
  );
}
