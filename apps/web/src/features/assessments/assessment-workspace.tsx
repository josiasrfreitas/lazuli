"use client";

import type { JSX as ReactJSX } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { FileList } from "~/features/assessment-files/attachments";
import { AssessmentEntryDialog } from "./assessment-entry-dialog";
import { AssessmentResults } from "./results-table";
import type { Assessment, Competence, Phase } from "./shared";
import styles from "./assessment-workspace.module.css";
type Attachment = RouterOutputs["assessmentFiles"]["list"][number];
type ActiveEdit = { competence: Competence; phase: Phase; trigger: HTMLButtonElement };

export function AssessmentWorkspace({
  data,
  onStateChange,
}: {
  data: Assessment;
  onStateChange?: ((state: { dirty: boolean; pending: boolean }) => void) | undefined;
}): ReactJSX.Element {
  const files = trpc.assessmentFiles.list.useQuery(
    { progressId: data.progressId },
    { refetchInterval: 5000 },
  );
  const [active, setActive] = useState<ActiveEdit | null>(null);
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
      <RecoverySection
        data={data}
        onEdit={(competence, trigger) => {
          setNotice("");
          setActive({ competence, phase: "RECOVERY", trigger });
        }}
      />
      <p role="status" className={styles.hint}>
        {notice || "Notas de 0 a 100 · corte 60"}
      </p>
      <UnidentifiedFiles rows={unidentified} refresh={() => void files.refetch()} />
      {active && (
        <ActiveAssessmentEditor
          active={active}
          data={data}
          onStateChange={onStateChange}
          onSaved={setNotice}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}

function ActiveAssessmentEditor({
  active,
  data,
  onStateChange,
  onSaved,
  onClose,
}: {
  active: ActiveEdit;
  data: Assessment;
  onStateChange?: ((state: { dirty: boolean; pending: boolean }) => void) | undefined;
  onSaved: (notice: string) => void;
  onClose: () => void;
}): ReactJSX.Element {
  return (
    <AssessmentEntryDialog
      data={data}
      competence={active.competence}
      initialPhase={active.phase}
      trigger={active.trigger}
      onStateChange={onStateChange}
      onSaved={onSaved}
      onClose={onClose}
    />
  );
}

function RecoverySection({
  data,
  onEdit,
}: {
  data: Assessment;
  onEdit: (competence: Competence, trigger: HTMLButtonElement) => void;
}): ReactJSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <details
      className={styles.recovery}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Recuperação</summary>
      {open && <AssessmentResults data={data} recovery onEdit={onEdit} />}
    </details>
  );
}

function UnidentifiedFiles({
  rows,
  refresh,
}: {
  rows: Attachment[];
  refresh: () => void;
}): ReactJSX.Element | null {
  if (rows.length === 0) return null;
  return (
    <details className={styles.recovery}>
      <summary>Arquivos a identificar · {rows.length}</summary>
      <FileList rows={rows} identify refresh={refresh} />
    </details>
  );
}
