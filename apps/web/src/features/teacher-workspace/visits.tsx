"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { Check, ChevronRight, Download, FileCheck2, FileUp, UserCheck, X } from "lucide-react";
import { PlacementAttachmentDialog } from "~/features/assessment-files/placement-attachment-dialog";
import { downloadFileBase64 } from "~/features/assessment-files/file-transfer";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  SegmentedControl,
  SegmentedControlItem,
  Textarea,
} from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { SelectControl } from "~/features/classes/form-controls";
import { TeacherPage, TeacherQueryState } from "./shared";
import { TeacherListLoading } from "./list-loading";

const DOWNLOAD_URL_REVOKE_DELAY_MS = 1000;
type Visit = RouterOutputs["teacherWorkspace"]["visit"];
const titles = {
  PLACEMENT: "Nivelamento",
  INTRODUCTION: "Aula experimental",
  TRIAL: "Experimental na turma",
};

export function TeacherVisits(): ReactJSX.Element {
  const query = trpc.teacherWorkspace.visits.useQuery();
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <TeacherPage
      title="Experimentais e nivelamentos"
      description="Encontros e correções atribuídos a você."
      back="/professor"
    >
      <TeacherQueryState
        loading={<TeacherListLoading label="Carregando seus encontros" status />}
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {query.data.map((row) => (
            <button
              key={row.id}
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted"
              onClick={() => setSelected(row.id)}
            >
              <span className="min-w-0 flex-1 text-sm font-semibold">
                {row.candidate.fullName}
                <span className="mt-1 block text-caption font-normal text-muted-foreground">
                  {titles[row.kind]} · {formatDateOnlyBR(row.date)} · {row.startTime}
                </span>
              </span>
              <Badge
                className="shrink-0"
                variant={row.assessment && !row.assessment.stageId ? "warning" : "neutral"}
              >
                {row.assessment?.stageId
                  ? "Corrigido"
                  : row.assessment
                    ? "Por corrigir"
                    : row.status === "SCHEDULED"
                      ? "Agendado"
                      : row.status === "CANCELLED"
                        ? "Cancelado"
                        : "Registrado"}
              </Badge>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          ))}
          {query.data.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">Nenhum encontro atribuído.</p>
          )}
        </div>
      )}
      {selected && <TeacherVisitDialog id={selected} onClose={() => setSelected(null)} />}
    </TeacherPage>
  );
}

export function TeacherVisitDialog({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}): ReactJSX.Element {
  const query = trpc.teacherWorkspace.visit.useQuery({ id });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="p-4 md:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {query.data ? titles[query.data.kind] : "Encontro"}
            </DialogTitle>
            {query.data && <DialogDescription>{query.data.candidate.fullName}</DialogDescription>}
          </DialogHeader>
          <DialogBody className="-mx-4 px-4">
            <TeacherQueryState
              label="Carregando encontro"
              pending={query.isPending}
              error={query.error}
              retry={() => void query.refetch()}
            />
            {query.data && <TeacherVisitBody key={query.data.id} visit={query.data} />}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={onClose}>
              <X aria-hidden="true" />
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
function TeacherVisitBody({ visit }: { visit: Visit }): ReactJSX.Element {
  const [outcome, setOutcome] = useState<"ATTENDED" | "ABSENT">(
    visit.status === "ABSENT" ? "ABSENT" : "ATTENDED",
  );
  const [notes, setNotes] = useState(visit.notes ?? "");
  const utils = trpc.useUtils();
  const refresh = (): Promise<[void, void]> =>
    Promise.all([utils.teacherWorkspace.invalidate(), utils.classRecords.invalidate()]);
  const save = trpc.teacherWorkspace.visitOutcome.useMutation({ onSuccess: refresh });
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 py-3">
      <p className="text-caption text-muted-foreground">
        {formatDateOnlyBR(visit.date)} · {visit.startTime}–{visit.endTime} ·{" "}
        {visit.format === "ONLINE" ? "Online" : "Presencial"}
      </p>
      {visit.kind === "PLACEMENT" && <TeacherPlacement visit={visit} />}
      {visit.canRecord && (visit.kind !== "PLACEMENT" || !visit.assessment) ? (
        <form
          className="grid min-w-0 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate({ id: visit.id, status: outcome, notes });
          }}
        >
          <SegmentedControl
            size="sm"
            wrap
            aria-label="Comparecimento"
            value={outcome}
            onValueChange={(value) => {
              if (value === "ATTENDED" || value === "ABSENT") setOutcome(value);
            }}
          >
            <SegmentedControlItem value="ATTENDED">Compareceu</SegmentedControlItem>
            <SegmentedControlItem value="ABSENT">Não compareceu</SegmentedControlItem>
          </SegmentedControl>
          <label className="grid gap-1 text-caption">
            Registro do encontro
            <Textarea
              size="sm"
              rows={2}
              value={notes}
              maxLength={2000}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Como foi a participação e o que precisa ser retomado?"
            />
          </label>
          {save.error && <Alert variant="destructive">{save.error.message}</Alert>}
          {save.isSuccess && (
            <p role="status" className="text-sm text-success">
              Comparecimento registrado.
            </p>
          )}
          <Button type="submit" size="sm" className="w-fit" disabled={save.isPending}>
            <UserCheck aria-hidden="true" />
            {save.isPending ? "Salvando…" : "Salvar comparecimento"}
          </Button>
        </form>
      ) : (
        visit.notes && <p className="whitespace-pre-wrap text-sm">{visit.notes}</p>
      )}
      {!visit.canRecord && (
        <p className="text-caption text-muted-foreground">
          Registro indisponível: o encontro ainda não começou ou está encerrado para alterações.
        </p>
      )}
    </div>
  );
}
function TeacherPlacement({ visit }: { visit: Visit }): ReactJSX.Element {
  const utils = trpc.useUtils();
  const refresh = (): Promise<[void, void]> =>
    Promise.all([utils.teacherWorkspace.invalidate(), utils.classRecords.invalidate()]);
  const stages = trpc.teacherWorkspace.stages.useQuery();
  const result = trpc.teacherWorkspace.placementResult.useMutation({ onSuccess: refresh });
  const download = trpc.teacherWorkspace.placementDownload.useMutation();
  const upload = trpc.teacherWorkspace.placementUpload.useMutation({ onSuccess: refresh });
  const [stageId, setStageId] = useState(visit.assessment?.stageId ?? "");
  const [notes, setNotes] = useState(visit.assessment?.notes ?? "");
  const [attaching, setAttaching] = useState<"ORIGINAL" | "CORRECTED" | null>(null);
  const canEdit = visit.canRecord && visit.status !== "ABSENT";
  return (
    <section className="grid min-w-0 grid-cols-1 gap-3">
      <h3 className="text-sm font-semibold">Prova de nivelamento</h3>
      {visit.assessment ? (
        <>
          <Button
            variant="secondary"
            size="sm"
            className="max-w-full justify-start"
            disabled={download.isPending}
            onClick={async () => {
              try {
                const file = await download.mutateAsync({ id: visit.id });
                const bytes = Uint8Array.from(atob(file.base64), (char) => char.codePointAt(0)!);
                const url = URL.createObjectURL(new Blob([bytes], { type: file.contentType }));
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = file.fileName;
                anchor.click();
                setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_REVOKE_DELAY_MS);
              } catch {
                /* Mutation error is shown below. */
              }
            }}
            title={visit.assessment.fileName}
          >
            <Download aria-hidden="true" />
            <span className="min-w-0 truncate">Baixar {visit.assessment.fileName}</span>
          </Button>
          {visit.assessment.stage && (
            <p className="text-sm">Estágio registrado: {visit.assessment.stage.name}</p>
          )}
          {canEdit && (
            <form
              className="grid min-w-0 gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (stageId) result.mutate({ id: visit.id, stageId, notes });
              }}
            >
              <TeacherQueryState
                label="Carregando estágios"
                pending={stages.isPending}
                error={stages.error}
                retry={() => void stages.refetch()}
              />
              {stages.data && (
                <SelectControl
                  name={`placement-stage-${visit.id}`}
                  label="Estágio indicado"
                  value={stageId}
                  onChange={setStageId}
                  choices={(stages.data ?? []).map((row) => ({ value: row.id, label: row.name }))}
                />
              )}
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
              <Button
                type="submit"
                size="sm"
                className="w-fit"
                disabled={!stageId || result.isPending}
              >
                <Check aria-hidden="true" />
                {result.isPending ? "Salvando…" : "Registrar resultado"}
              </Button>
              {result.isSuccess && (
                <p role="status" className="text-sm text-success">
                  Resultado salvo.
                </p>
              )}
            </form>
          )}
          <div className="grid min-w-0 justify-items-start gap-2 border-t border-border pt-3">
            <h4 className="flex items-center gap-1.5 text-caption font-medium">
              <FileCheck2 aria-hidden="true" className="size-4" />
              Prova corrigida · opcional
            </h4>
            {visit.assessment.correctedFile ? (
              <Button
                variant="secondary"
                size="sm"
                loading={download.isPending}
                onClick={async () => {
                  try {
                    downloadFileBase64(
                      await download.mutateAsync({ id: visit.id, kind: "CORRECTED" }),
                    );
                  } catch {
                    /* Shown below. */
                  }
                }}
                title={visit.assessment.correctedFile.fileName}
              >
                <Download />
                Baixar prova corrigida
              </Button>
            ) : canEdit ? (
              <Button variant="secondary" size="sm" onClick={() => setAttaching("CORRECTED")}>
                <FileUp />
                Anexar prova corrigida
              </Button>
            ) : (
              <p className="text-caption text-muted-foreground">
                Nenhuma versão corrigida anexada.
              </p>
            )}
          </div>
        </>
      ) : (
        canEdit && (
          <div className="grid justify-items-start gap-3">
            <p className="text-caption text-muted-foreground">
              Envie uma foto ou PDF da prova aplicada. Depois, registre o estágio indicado.
            </p>
            <Button size="sm" onClick={() => setAttaching("ORIGINAL")}>
              <FileUp />
              Anexar prova
            </Button>
          </div>
        )
      )}
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
