"use client";

import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { FileList } from "~/features/assessment-files/attachments";
import { AssessmentEntryDialog } from "./assessment-entry-dialog";
import { AssessmentResults } from "./results-table";
import type { Assessment, Competence, Phase } from "./shared";
import styles from "./assessment-workspace.module.css";

export function AssessmentWorkspace({
  data,
  onStateChange,
}: {
  data: Assessment;
  onStateChange?: (state: { dirty: boolean; pending: boolean }) => void;
}): ReactJSX.Element {
  const files = trpc.assessmentFiles.list.useQuery(
    { progressId: data.progressId },
    { refetchInterval: 5000 },
  );
  const [active, setActive] = useState<{
    competence: Competence;
    phase: Phase;
    trigger: HTMLButtonElement;
  } | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [notice, setNotice] = useState("");
  const unidentified = files.data?.filter((file) => !file.competence) ?? [];

  return (
    <div className={styles.workspace}>
      <p className={styles.hint}>
        Edite notas, arquivos e observações pelo botão ao fim de cada linha.
      </p>
      <AssessmentResults
        data={data}
        onEdit={(competence, trigger) => {
          setNotice("");
          setActive({ competence, phase: "BLOCK_ONE", trigger });
        }}
      />
      <details
        className={styles.recovery}
        open={recovery}
        onToggle={(event) => setRecovery(event.currentTarget.open)}
      >
        <summary>Recuperação</summary>
        {recovery && (
          <AssessmentResults
            data={data}
            recovery
            onEdit={(competence, trigger) => {
              setNotice("");
              setActive({ competence, phase: "RECOVERY", trigger });
            }}
          />
        )}
      </details>
      <p role="status" className={styles.hint}>
        {notice || "Notas de 0 a 100 · corte 60"}
      </p>
      {unidentified.length > 0 && (
        <details className={styles.recovery}>
          <summary>Arquivos a identificar · {unidentified.length}</summary>
          <FileList rows={unidentified} identify refresh={() => void files.refetch()} />
        </details>
      )}
      {active && (
        <AssessmentEntryDialog
          data={data}
          competence={active.competence}
          initialPhase={active.phase}
          trigger={active.trigger}
          onStateChange={onStateChange}
          onSaved={setNotice}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
