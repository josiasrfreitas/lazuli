"use client";

import { useState, type JSX as ReactJSX } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Check, Download, FileCheck2, FileUp } from "lucide-react";
import { Alert, Button, Textarea } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { SelectControl } from "~/features/classes/form-controls";
import { PlacementAttachmentDialog } from "~/features/assessment-files/placement-attachment-dialog";
import { downloadFileBase64 } from "~/features/assessment-files/file-transfer";
import { TeacherQueryState } from "./shared";

type Visit = RouterOutputs["teacherWorkspace"]["visit"];
type AttachmentKind = "ORIGINAL" | "CORRECTED";
type PlacementActions = {
  canEdit: boolean;
  downloading: boolean;
  saving: boolean;
  saved: boolean;
  downloadOriginal: () => void;
  downloadCorrected: () => void;
  attach: (kind: AttachmentKind) => void;
  save: (input: { stageId: string; notes: string }) => void;
};

export function TeacherPlacement({ visit }: { visit: Visit }): ReactJSX.Element {
  const utils = trpc.useUtils();
  const refresh = (): Promise<[void, void]> =>
    Promise.all([utils.teacherWorkspace.invalidate(), utils.classRecords.invalidate()]);
  const result = trpc.teacherWorkspace.placementResult.useMutation({ onSuccess: refresh });
  const download = trpc.teacherWorkspace.placementDownload.useMutation();
  const upload = trpc.teacherWorkspace.placementUpload.useMutation({ onSuccess: refresh });
  const [attaching, setAttaching] = useState<AttachmentKind | null>(null);
  const actions: PlacementActions = {
    canEdit: visit.canRecord && visit.status !== "ABSENT",
    downloading: download.isPending,
    saving: result.isPending,
    saved: result.isSuccess,
    downloadOriginal: () => {
      void download
        .mutateAsync({ id: visit.id })
        .then(downloadFileBase64)
        .catch(() => {});
    },
    downloadCorrected: () => {
      void download
        .mutateAsync({ id: visit.id, kind: "CORRECTED" })
        .then(downloadFileBase64)
        .catch(() => {});
    },
    attach: setAttaching,
    save: ({ stageId, notes }) => result.mutate({ id: visit.id, stageId, notes }),
  };
  return (
    <section className="grid min-w-0 grid-cols-1 gap-3">
      <h3 className="text-sm font-semibold">Prova de nivelamento</h3>
      <PlacementContent visit={visit} actions={actions} />
      {(result.error || download.error) && (
        <Alert variant="destructive">{result.error?.message || download.error?.message}</Alert>
      )}
      {attaching && (
        <PlacementAttachmentDialog
          visit={visit}
          person={visit.candidate.fullName}
          kind={attaching}
          onUpload={(file) => upload.mutateAsync(file)}
          onClose={() => setAttaching(null)}
        />
      )}
    </section>
  );
}

function PlacementContent({
  visit,
  actions,
}: {
  visit: Visit;
  actions: PlacementActions;
}): ReactJSX.Element | null {
  if (!visit.assessment) {
    return actions.canEdit ? <OriginalPrompt onAttach={() => actions.attach("ORIGINAL")} /> : null;
  }
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className="max-w-full justify-start"
        disabled={actions.downloading}
        onClick={actions.downloadOriginal}
        title={visit.assessment.fileName}
      >
        <Download aria-hidden="true" />
        <span className="min-w-0 truncate">Baixar {visit.assessment.fileName}</span>
      </Button>
      {visit.assessment.stage && (
        <p className="text-sm">Estágio registrado: {visit.assessment.stage.name}</p>
      )}
      {actions.canEdit && <PlacementResultForm visit={visit} actions={actions} />}
      <CorrectedEvidence visit={visit} actions={actions} />
    </>
  );
}

function OriginalPrompt({ onAttach }: { onAttach: () => void }): ReactJSX.Element {
  return (
    <div className="grid justify-items-start gap-3">
      <p className="text-caption text-muted-foreground">
        Envie uma foto ou PDF da prova aplicada. Depois, registre o estágio indicado.
      </p>
      <Button size="sm" onClick={onAttach}>
        <FileUp />
        Anexar prova
      </Button>
    </div>
  );
}

function PlacementResultForm({
  visit,
  actions,
}: {
  visit: Visit;
  actions: PlacementActions;
}): ReactJSX.Element {
  const [stageId, setStageId] = useState(visit.assessment?.stageId ?? "");
  const [notes, setNotes] = useState(visit.assessment?.notes ?? "");
  return (
    <form
      className="grid min-w-0 gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (stageId) actions.save({ stageId, notes });
      }}
    >
      <StageChoice visitId={visit.id} stageId={stageId} onChange={setStageId} />
      <label className="grid gap-1 text-caption">
        Observações da correção
        <Textarea
          size="sm"
          rows={2}
          value={notes}
          maxLength={2000}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      <Button type="submit" size="sm" className="w-fit" disabled={!stageId || actions.saving}>
        <Check aria-hidden="true" />
        {actions.saving ? "Salvando…" : "Registrar resultado"}
      </Button>
      {actions.saved && (
        <p role="status" className="text-sm text-success">
          Resultado salvo.
        </p>
      )}
    </form>
  );
}

function StageChoice({
  visitId,
  stageId,
  onChange,
}: {
  visitId: string;
  stageId: string;
  onChange: (value: string) => void;
}): ReactJSX.Element {
  const stages = trpc.teacherWorkspace.stages.useQuery();
  return (
    <>
      <TeacherQueryState
        label="Carregando estágios"
        pending={stages.isPending}
        error={stages.error}
        retry={() => void stages.refetch()}
      />
      {stages.data && (
        <SelectControl
          name={`placement-stage-${visitId}`}
          label="Estágio indicado"
          value={stageId}
          onChange={onChange}
          choices={stages.data.map((row) => ({ value: row.id, label: row.name }))}
        />
      )}
    </>
  );
}

function CorrectedEvidence({
  visit,
  actions,
}: {
  visit: Visit;
  actions: PlacementActions;
}): ReactJSX.Element {
  return (
    <div className="grid min-w-0 justify-items-start gap-2 border-t border-border pt-3">
      <h4 className="flex items-center gap-1.5 text-caption font-medium">
        <FileCheck2 aria-hidden="true" className="size-4" />
        Prova corrigida · opcional
      </h4>
      <CorrectedAction visit={visit} actions={actions} />
    </div>
  );
}

function CorrectedAction({
  visit,
  actions,
}: {
  visit: Visit;
  actions: PlacementActions;
}): ReactJSX.Element {
  if (visit.assessment?.correctedFile) {
    return (
      <Button
        variant="secondary"
        size="sm"
        loading={actions.downloading}
        onClick={actions.downloadCorrected}
        title={visit.assessment.correctedFile.fileName}
      >
        <Download />
        Baixar prova corrigida
      </Button>
    );
  }
  if (actions.canEdit) {
    return (
      <Button variant="secondary" size="sm" onClick={() => actions.attach("CORRECTED")}>
        <FileUp />
        Anexar prova corrigida
      </Button>
    );
  }
  return <p className="text-caption text-muted-foreground">Nenhuma versão corrigida anexada.</p>;
}
