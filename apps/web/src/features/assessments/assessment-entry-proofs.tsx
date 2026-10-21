import type { ReactElement } from "react";
import { RotateCcw } from "lucide-react";
import { Alert, Button, FileUpload, PencilLoader } from "@lazuli/ui";
import { MAX_UPLOAD_FILE_BYTES } from "@lazuli/validators";
import { FileList } from "~/features/assessment-files/attachments";
import type { EntryState } from "./assessment-entry.types";
import styles from "./assessment-workspace.module.css";
export function EntryProofsField({ state }: { state: EntryState }): ReactElement {
  return (
    <div className={styles.proof}>
      <ProofPicker state={state} />
      {state.files.isPending && <PencilLoader size="sm" label="Consultando arquivos" />}
      {state.files.error && (
        <Alert variant="destructive">
          Não foi possível consultar os arquivos.
          <Button size="sm" variant="ghost" onClick={() => void state.files.refetch()}>
            <RotateCcw aria-hidden="true" />
            Tentar novamente
          </Button>
        </Alert>
      )}
      {state.existing.length > 0 && (
        <FileList
          rows={state.existing}
          showPhase={false}
          refresh={() => void state.files.refetch()}
        />
      )}
    </div>
  );
}
function ProofPicker({ state }: { state: EntryState }): ReactElement {
  return (
    <FileUpload
      key={state.phase}
      compact
      value={state.selected}
      disabled={state.busy}
      multiple
      camera
      accept="application/pdf,image/jpeg,image/png"
      acceptLabel="PDF, JPG ou PNG"
      maxSize={MAX_UPLOAD_FILE_BYTES}
      onValueChange={(files) =>
        state.setAttachments((current) => [
          ...current.filter((row) => row.phase !== state.phase),
          { phase: state.phase, files },
        ])
      }
    />
  );
}
