"use client";

import type { Dispatch, JSX as ReactJSX, RefObject, SetStateAction } from "react";
import { useId, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  FileCheck2,
  FileText,
  FileUp,
  GraduationCap,
  MessageSquare,
  Pencil,
  UserRound,
  X,
} from "lucide-react";
import {
  ToastAlert,
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
  Field,
  Label,
  Textarea,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { TextControl, SelectControl } from "~/features/classes/form-controls";
import { schoolToday } from "~/features/class-records/calendar-model";
import { PlacementAttachmentDialog } from "~/features/assessment-files/placement-attachment-dialog";
import { downloadFileBase64 } from "~/features/assessment-files/file-transfer";
import { IntakeStageSelect } from "./intake-fields";
import { dateLabel, formatLabel, type Candidate } from "./labels";
import { placementHasStarted, placementStatus } from "./placement-state";
import styles from "./placement-review.module.css";

type Visit = Candidate["visits"][number];

export function PlacementVisit({
  visit,
  editable,
  person,
  initialUpload,
  onClose,
}: {
  visit: Visit;
  editable: boolean;
  person: string;
  initialUpload: boolean;
  onClose: () => void;
}): ReactJSX.Element {
  const model = usePlacementModel({ visit, editable, initialUpload });
  if (model.attaching)
    return (
      <PlacementAttachmentDialog
        visit={visit}
        person={person}
        kind={model.attaching}
        onUpload={(file) => model.upload.mutateAsync(file)}
        onClose={() => {
          if (initialUpload && model.attaching === "ORIGINAL" && !visit.assessment) onClose();
          else model.setAttaching(null);
        }}
        onComplete={() => model.setAttaching(null)}
      />
    );
  return <PlacementVisitDetails visit={visit} person={person} onClose={onClose} model={model} />;
}

type PlacementMutations = {
  download: ReturnType<typeof trpc.admissions.placementDownload.useMutation>;
  result: ReturnType<typeof trpc.admissions.placementResult.useMutation>;
  upload: ReturnType<typeof trpc.admissions.placementUpload.useMutation>;
  cancel: ReturnType<typeof trpc.admissions.outcome.useMutation>;
  assign: ReturnType<typeof trpc.admissions.assignPlacement.useMutation>;
};

function usePlacementMutations(): PlacementMutations {
  const utils = trpc.useUtils();
  const refresh = (): Promise<void[]> =>
    Promise.all([
      utils.admissions.invalidate(),
      utils.classRecords.invalidate(),
      utils.students.pendingActions.invalidate(),
      utils.teacherWorkspace.invalidate(),
      utils.dashboard.invalidate(),
    ]);
  const download = trpc.admissions.placementDownload.useMutation();
  const result = trpc.admissions.placementResult.useMutation({ onSuccess: refresh });
  const upload = trpc.admissions.placementUpload.useMutation({ onSuccess: refresh });
  const cancel = trpc.admissions.outcome.useMutation({ onSuccess: refresh });
  const assign = trpc.admissions.assignPlacement.useMutation({ onSuccess: refresh });
  return { download, result, upload, cancel, assign };
}

type PlacementModel = PlacementMutations & {
  stageId: string | null;
  setStageId: Dispatch<SetStateAction<string | null>>;
  notes: string;
  setNotes: Dispatch<SetStateAction<string>>;
  editing: boolean;
  setEditing: Dispatch<SetStateAction<boolean>>;
  cancellation: string | null;
  setCancellation: Dispatch<SetStateAction<string | null>>;
  attaching: "ORIGINAL" | "CORRECTED" | null;
  setAttaching: Dispatch<SetStateAction<"ORIGINAL" | "CORRECTED" | null>>;
  title: RefObject<HTMLHeadingElement | null>;
  formId: string;
  inactive: boolean;
  canEdit: boolean;
  started: boolean;
  pending: boolean;
  status: ReturnType<typeof placementStatus>;
};

function usePlacementModel({
  visit,
  editable,
  initialUpload,
}: {
  visit: Visit;
  editable: boolean;
  initialUpload: boolean;
}): PlacementModel {
  const mutations = usePlacementMutations();
  const [stageId, setStageId] = useState<string | null>(visit.assessment?.stageId ?? null);
  const [notes, setNotes] = useState(visit.assessment?.notes ?? "");
  const [editing, setEditing] = useState(!visit.assessment?.stageId);
  const [cancellation, setCancellation] = useState<string | null>(null);
  const [attaching, setAttaching] = useState<"ORIGINAL" | "CORRECTED" | null>(
    initialUpload ? "ORIGINAL" : null,
  );
  const title = useRef<HTMLHeadingElement>(null);
  const formId = useId();
  const inactive = visit.status === "CANCELLED" || visit.status === "ABSENT";
  const canEdit = editable && !inactive;
  const started = placementHasStarted(visit);
  const pending = [mutations.result, mutations.cancel, mutations.assign, mutations.upload].some(
    (mutation) => mutation.isPending,
  );
  const status = placementStatus(visit);
  return {
    ...mutations,
    stageId,
    setStageId,
    notes,
    setNotes,
    editing,
    setEditing,
    cancellation,
    setCancellation,
    attaching,
    setAttaching,
    title,
    formId,
    inactive,
    canEdit,
    started,
    pending,
    status,
  };
}

type VisitViewProps = { visit: Visit; model: PlacementModel };

function PlacementVisitDetails({
  visit,
  person,
  onClose,
  model,
}: VisitViewProps & {
  person: string;
  onClose: () => void;
}): ReactJSX.Element {
  const { title, pending } = model;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] md:max-w-xl"
          showCloseButton={!pending}
          initialFocus={() => title.current}
        >
          <DialogHeader>
            <DialogTitle ref={title} tabIndex={-1} className="outline-none">
              Nivelamento
            </DialogTitle>
            <DialogDescription>{person}</DialogDescription>
          </DialogHeader>
          <PlacementVisitBody visit={visit} model={model} />
          <PlacementVisitFooter visit={visit} model={model} onClose={onClose} />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function PlacementVisitBody({ visit, model }: VisitViewProps): ReactJSX.Element {
  const { status } = model;
  return (
    <DialogBody>
      <div className={styles.body}>
        <div className={styles.context}>
          <p>
            {dateLabel(visit.date)} · {visit.startTime}–{visit.endTime}
            <br />
            {formatLabel(visit.format)}
          </p>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <PlacementProof visit={visit} model={model} />
        <PlacementResult visit={visit} model={model} />
        <PlacementTeacher visit={visit} model={model} />
        {visit.cancellationReason && (
          <p className="text-caption text-muted-foreground">{visit.cancellationReason}</p>
        )}
      </div>
    </DialogBody>
  );
}

function PlacementVisitFooter({
  visit,
  model,
  onClose,
}: VisitViewProps & {
  onClose: () => void;
}): ReactJSX.Element {
  const { result, stageId, editing, formId, canEdit, pending } = model;
  return (
    <DialogFooter className="mt-4 flex flex-row justify-end gap-3 border-t border-border pt-4 max-sm:[&>button]:min-h-11 max-sm:[&>button]:min-w-0 max-sm:[&>button]:flex-1 max-sm:[&>button]:whitespace-normal max-sm:[&>button]:px-3">
      <Button variant="secondary" disabled={pending} onClick={onClose}>
        <X />
        Fechar
      </Button>
      {canEdit && editing && visit.assessment && (
        <Button
          type="submit"
          form={formId}
          loading={result.isPending}
          disabled={!stageId || pending}
        >
          <Check />
          Registrar estágio
        </Button>
      )}
    </DialogFooter>
  );
}

function PlacementProof({ visit, model }: VisitViewProps): ReactJSX.Element {
  const { download, inactive, started, canEdit, pending, setAttaching } = model;
  return (
    <section className={styles.section}>
      {visit.assessment ? (
        <div className={styles.proof}>
          <FileText aria-hidden="true" />
          <div>
            <p>Prova aplicada</p>
            <strong>{visit.assessment.fileName}</strong>
            <p>Anexada por {visit.assessment.uploadedBy.name}</p>
          </div>
          <Button
            variant="secondary"
            size="compact-responsive"
            loading={download.isPending}
            onClick={() => requestDownload({ download, visitId: visit.id })}
          >
            <Download />
            Baixar
          </Button>
        </div>
      ) : (
        <div className={styles.emptyProof}>
          <FileUp aria-hidden="true" />
          <h3>{inactive ? "Nenhuma prova anexada" : "Anexe a prova aplicada"}</h3>
          <p>{emptyProofDescription(inactive, started)}</p>
          {canEdit && (
            <Button
              size="compact-responsive"
              disabled={!started || pending}
              onClick={() => setAttaching("ORIGINAL")}
            >
              <FileUp />
              Anexar prova
            </Button>
          )}
        </div>
      )}
      {download.error && <ToastAlert variant="destructive">{download.error.message}</ToastAlert>}
    </section>
  );
}

function emptyProofDescription(inactive: boolean, started: boolean): string {
  if (inactive) return "Este atendimento está encerrado para alterações.";
  if (started) return "Envie uma foto ou PDF. Depois, registre o estágio indicado pelo professor.";
  return "O envio fica disponível a partir do início do atendimento. Você pode definir o professor agora.";
}

function PlacementResult({ visit, model }: VisitViewProps): ReactJSX.Element | null {
  const { result, editing, setEditing, canEdit } = model;
  if (!visit.assessment) return null;
  return (
    <section className={styles.result}>
      <div className={styles.resultActions}>
        <h3>Resultado do nivelamento</h3>
        {canEdit && !editing && (
          <Button variant="ghost" size="compact-responsive" onClick={() => setEditing(true)}>
            <Pencil />
            Editar resultado
          </Button>
        )}
      </div>
      {canEdit && editing ? (
        <PlacementResultForm visit={visit} model={model} />
      ) : (
        <PlacementResultSummary assessment={visit.assessment} />
      )}
      {result.error && <ToastAlert variant="destructive">{result.error.message}</ToastAlert>}
      <PlacementCorrectedProof visit={visit} model={model} />
    </section>
  );
}

function PlacementResultSummary({
  assessment,
}: {
  assessment: NonNullable<Visit["assessment"]>;
}): ReactJSX.Element {
  return (
    <>
      <strong>{assessment.stage?.name ?? "Aguardando correção"}</strong>
      {assessment.correctedBy && <p>Resultado registrado por {assessment.correctedBy.name}.</p>}
      {assessment.notes && <p>{assessment.notes}</p>}
    </>
  );
}

function requestDownload({
  download,
  visitId,
  kind,
}: {
  download: PlacementModel["download"];
  visitId: string;
  kind?: "CORRECTED";
}): void {
  void download
    .mutateAsync(kind ? { id: visitId, kind } : { id: visitId })
    .then(downloadFileBase64)
    .catch(() => {
      // The mutation error is displayed in the dialog.
    });
}

function PlacementTeacher({ visit, model }: VisitViewProps): ReactJSX.Element | null {
  const { assign, cancel, canEdit, pending } = model;
  const teachers = trpc.teachers.options.useQuery({ date: schoolToday(), search: "" });
  if (!canEdit) return null;
  return (
    <section className={styles.secondary}>
      <SelectControl
        name={`placement-teacher-${visit.id}`}
        label="Professor responsável pela correção"
        labelIcon={<UserRound aria-hidden="true" className="size-4 text-icon" />}
        value={visit.teacherId ?? ""}
        onChange={(value) => {
          if (!pending) assign.mutate({ id: visit.id, teacherId: value || null });
        }}
        choices={[
          { value: "", label: "Atribuir depois" },
          ...(visit.teacherId && !teachers.data?.some((teacher) => teacher.id === visit.teacherId)
            ? [
                {
                  value: visit.teacherId,
                  label: visit.teacherName ?? "Professor atribuído",
                },
              ]
            : []),
          ...(teachers.data ?? []).map((teacher) => ({
            value: teacher.id,
            label: teacher.name,
          })),
        ]}
      />
      {assign.error && <ToastAlert variant="destructive">{assign.error.message}</ToastAlert>}
      <PlacementCancellation visit={visit} model={model} />
      {cancel.error && <ToastAlert variant="destructive">{cancel.error.message}</ToastAlert>}
    </section>
  );
}

function PlacementCancellation({ visit, model }: VisitViewProps): ReactJSX.Element | null {
  const { cancel, cancellation, setCancellation, pending } = model;
  if (visit.assessment) return null;
  if (cancellation === null)
    return (
      <Button
        variant="destructive-ghost"
        size="compact-responsive"
        onClick={() => setCancellation("")}
      >
        <X />
        Cancelar atendimento
      </Button>
    );
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (cancellation.trim() && !pending)
          cancel.mutate({ id: visit.id, status: "CANCELLED", notes: cancellation });
      }}
    >
      <TextControl
        name={`cancel-${visit.id}`}
        label="Motivo do cancelamento"
        labelIcon={<MessageSquare aria-hidden="true" className="size-4 text-icon" />}
        placeholder="Descreva o motivo"
        value={cancellation}
        onChange={setCancellation}
      />
      <div className={styles.resultActions}>
        <Button variant="ghost" disabled={pending} onClick={() => setCancellation(null)}>
          <ArrowLeft />
          Voltar
        </Button>
        <Button
          type="submit"
          variant="destructive"
          loading={cancel.isPending}
          disabled={!cancellation.trim() || pending}
        >
          <X />
          Confirmar cancelamento
        </Button>
      </div>
    </form>
  );
}

function PlacementResultForm({ visit, model }: VisitViewProps): ReactJSX.Element {
  const { formId, stageId, setStageId, notes, setNotes, pending, result, setEditing } = model;
  return (
    <form
      id={formId}
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (stageId && !pending)
          result.mutate({ id: visit.id, stageId, notes }, { onSuccess: () => setEditing(false) });
      }}
    >
      <IntakeStageSelect
        value={stageId}
        onChange={setStageId}
        disabled={pending}
        openOnFocus={false}
        labelIcon={<GraduationCap aria-hidden="true" className="size-4 text-icon" />}
      />
      <Field>
        <Label htmlFor={`placement-notes-${visit.id}`}>
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare aria-hidden="true" className="size-4 text-icon" />
            Observações da correção
          </span>
        </Label>
        <Textarea
          id={`placement-notes-${visit.id}`}
          name={`placement-notes-${visit.id}`}
          rows={4}
          maxLength={2000}
          disabled={pending}
          placeholder="Pontos observados na prova"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>
    </form>
  );
}

function PlacementCorrectedProof({ visit, model }: VisitViewProps): ReactJSX.Element | null {
  const { download, canEdit, pending, setAttaching } = model;
  if (!visit.assessment) return null;
  return (
    <div className={styles.correctedFile}>
      <h4>
        <FileCheck2 aria-hidden="true" />
        Prova corrigida <span>Opcional</span>
      </h4>
      {visit.assessment.correctedFile ? (
        <div className={styles.proof}>
          <FileCheck2 aria-hidden="true" />
          <div>
            <strong>{visit.assessment.correctedFile.fileName}</strong>
            <p>Anexada por {visit.assessment.correctedFile.uploadedBy.name}</p>
          </div>
          <Button
            variant="secondary"
            size="compact-responsive"
            loading={download.isPending}
            onClick={() => requestDownload({ download, visitId: visit.id, kind: "CORRECTED" })}
          >
            <Download />
            Baixar
          </Button>
        </div>
      ) : (
        <>
          <p>
            {canEdit
              ? "Você pode anexar a versão com as correções do professor."
              : "Nenhuma versão corrigida anexada."}
          </p>
          {canEdit && (
            <Button
              variant="secondary"
              size="compact-responsive"
              disabled={pending}
              onClick={() => setAttaching("CORRECTED")}
            >
              <FileUp />
              Anexar prova corrigida
            </Button>
          )}
        </>
      )}
    </div>
  );
}
