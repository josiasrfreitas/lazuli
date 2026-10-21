"use client";
import { useState, type ReactElement } from "react";
import { trpc } from "~/lib/trpc";
import { FileList, type FileRow } from "~/features/assessment-files/attachments";
import { AssessmentEntryDialog } from "./assessment-entry-dialog";
import { AssessmentResults } from "./results-table";
import type { Assessment, Competence, Phase } from "./shared";
import styles from "./assessment-workspace.module.css";
const FILE_POLL_MS = 5000;
type Edit = (competence: Competence, trigger: HTMLButtonElement) => void;
type WorkspaceProps = {
  data: Assessment;
  onStateChange?: ((state: { dirty: boolean; pending: boolean }) => void) | undefined;
};
export function AssessmentWorkspace({ data, onStateChange }: WorkspaceProps): ReactElement {
  const files = trpc.assessmentFiles.list.useQuery(
    { progressId: data.progressId },
    { refetchInterval: FILE_POLL_MS },
  );
  const [active, setActive] = useState<ActiveEntry | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [notice, setNotice] = useState("");
  const unidentified = files.data?.filter((file) => !file.competence) ?? [];
  const open: (
    competence: Competence,
    values: { phase: Phase; trigger: HTMLButtonElement },
  ) => void = (competence, values) => {
    setNotice("");
    setActive({ competence, ...values });
  };
  return (
    <div className={styles.workspace}>
      <p className={styles.hint}>
        Edite notas, arquivos e observações pelo botão ao fim de cada linha.
      </p>
      <AssessmentResults
        data={data}
        onEdit={(competence, trigger) => open(competence, { phase: "BLOCK_ONE", trigger })}
      />
      <RecoveryDisclosure
        data={data}
        recovery={recovery}
        setRecovery={setRecovery}
        onEdit={(competence, trigger) => open(competence, { phase: "RECOVERY", trigger })}
      />
      <p role="status" className={styles.hint}>
        {notice || "Notas de 0 a 100 · corte 60"}
      </p>
      <UnidentifiedProofs rows={unidentified} refresh={() => void files.refetch()} />
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
function RecoveryDisclosure({
  data,
  recovery,
  setRecovery,
  onEdit,
}: {
  data: Assessment;
  recovery: boolean;
  setRecovery: (open: boolean) => void;
  onEdit: Edit;
}): ReactElement {
  return (
    <details
      className={styles.recovery}
      open={recovery}
      onToggle={(event) => setRecovery(event.currentTarget.open)}
    >
      <summary>Recuperação</summary>
      {recovery && <AssessmentResults data={data} recovery onEdit={onEdit} />}
    </details>
  );
}
function UnidentifiedProofs({
  rows,
  refresh,
}: {
  rows: FileRow[];
  refresh: () => void;
}): ReactElement | null {
  if (rows.length === 0) return null;
  return (
    <details className={styles.recovery}>
      <summary>Arquivos a identificar · {rows.length}</summary>
      <FileList rows={rows} identify refresh={refresh} />
    </details>
  );
}

type ActiveEntry = { competence: Competence; phase: Phase; trigger: HTMLButtonElement };
