"use client";

import type { Dispatch, JSX as ReactJSX, SetStateAction } from "react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { RotateCcw, Save, X } from "lucide-react";
import { MAX_UPLOAD_FILE_BYTES } from "@lazuli/validators";
import type { RouterOutputs } from "@lazuli/api";
import {
  ToastAlert,
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
  FieldError,
  FileUpload,
  Input,
  Label,
  PencilLoader,
  SegmentedControl,
  SegmentedControlItem,
  Textarea,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { AssessmentGradeFields } from "./assessment-grade-fields";
import { FileList } from "~/features/assessment-files/attachments";
import { useAssessmentUploads } from "~/features/assessment-files/queue-provider";
import { DiscardRegistrationDialog } from "~/features/shared/discard-registration-dialog";
import { useAssessmentForm, type GradeDraft } from "./use-assessment-form";
import {
  COMPETENCE_LABELS,
  PHASE_LABELS,
  PHASES,
  type Assessment,
  type Competence,
  type Phase,
} from "./shared";
import styles from "./assessment-workspace.module.css";

const ATTACHMENT_REFRESH_INTERVAL_MS = 5000;
type AttachmentDraft = { phase: Phase; files: File[] };
type Props = {
  data: Assessment;
  competence: Competence;
  initialPhase: Phase;
  trigger: HTMLButtonElement;
  onStateChange?: ((state: { dirty: boolean; pending: boolean }) => void) | undefined;
  onSaved: (notice: string) => void;
  onClose: () => void;
};
type EntryFields = {
  id: string;
  form: ReturnType<typeof useAssessmentForm>;
  phase: Phase;
  setPhase: Dispatch<SetStateAction<Phase>>;
  baseline: GradeDraft[];
  setBaseline: Dispatch<SetStateAction<GradeDraft[]>>;
  attachments: AttachmentDraft[];
  setAttachments: Dispatch<SetStateAction<AttachmentDraft[]>>;
  proof: boolean;
  filesPending: boolean;
  filesError: boolean;
  refreshFiles: () => void;
  existing: RouterOutputs["assessmentFiles"]["list"];
  selected: File[];
  index: number;
  grade: GradeDraft;
  changed: boolean;
  gradeChanged: boolean;
  pendingCount: number;
};
type EntryActions = {
  busy: boolean;
  dirty: boolean;
  uploadError: string;
  discard: boolean;
  setDiscard: Dispatch<SetStateAction<boolean>>;
  requestClose: () => void;
  submit: (event: FormEvent) => Promise<void>;
};
type EntryModel = { props: Props; fields: EntryFields; actions: EntryActions };

function changedGrade(grades: GradeDraft[], baseline: GradeDraft[]): boolean {
  return grades.some((grade, index) => {
    const previous = baseline[index]!;
    return (
      grade.score !== previous.score ||
      grade.date !== previous.date ||
      grade.reason !== previous.reason
    );
  });
}

function useInvalidGradePhase({
  form,
  competence,
  setPhase,
}: {
  form: EntryFields["form"];
  competence: Competence;
  setPhase: EntryFields["setPhase"];
}): void {
  useEffect(() => {
    const key = Object.keys(form.errors).find(
      (item) => form.errors[item] && item.startsWith("grades."),
    );
    const invalid = key ? form.grades[Number(key.split(".")[1])] : null;
    if (invalid?.competence === competence) setPhase(invalid.phase);
  }, [form.errors, form.grades, competence, setPhase]);
}

function useEntryFields({ data, competence, initialPhase }: Props): EntryFields {
  const id = useId();
  const form = useAssessmentForm(data);
  const proof = competence === "WRITTEN" || competence === "LISTENING";
  const files = trpc.assessmentFiles.list.useQuery(
    { progressId: data.progressId },
    { enabled: proof, refetchInterval: proof ? ATTACHMENT_REFRESH_INTERVAL_MS : false },
  );
  const [phase, setPhase] = useState(initialPhase);
  const [baseline, setBaseline] = useState(form.grades);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const changed = JSON.stringify(form.grades) !== JSON.stringify(baseline);
  const gradeChanged = changedGrade(form.grades, baseline);
  const pendingCount = attachments.reduce((count, draft) => count + draft.files.length, 0);
  const index = form.grades.findIndex(
    (row) => row.phase === phase && row.competence === competence,
  );
  const grade = form.grades[index]!;
  const selected = attachments.find((row) => row.phase === phase)?.files ?? [];
  const existing =
    files.data?.filter((row) => row.phase === phase && row.competence === competence) ?? [];
  useInvalidGradePhase({ form, competence, setPhase });
  return {
    id,
    form,
    phase,
    setPhase,
    baseline,
    setBaseline,
    attachments,
    setAttachments,
    proof,
    filesPending: files.isPending,
    filesError: Boolean(files.error),
    refreshFiles: () => {
      void files.refetch();
    },
    existing,
    selected,
    index,
    grade,
    changed,
    gradeChanged,
    pendingCount,
  };
}

async function uploadDrafts({
  attachments,
  add,
  data,
  competence,
  setAttachments,
}: {
  attachments: AttachmentDraft[];
  add: ReturnType<typeof useAssessmentUploads>["add"];
  data: Assessment;
  competence: "WRITTEN" | "LISTENING";
  setAttachments: EntryFields["setAttachments"];
}): Promise<void> {
  for (const draft of attachments) {
    for (const file of draft.files) {
      await add([file], { progressId: data.progressId, phase: draft.phase, competence });
      setAttachments((current) =>
        current.map((row) =>
          row.phase === draft.phase
            ? { ...row, files: row.files.filter((item) => item !== file) }
            : row,
        ),
      );
    }
  }
}

function useEntryNotifications({
  onStateChange,
  dirty,
  busy,
}: {
  onStateChange: Props["onStateChange"];
  dirty: boolean;
  busy: boolean;
}): void {
  useEffect(() => {
    onStateChange?.({ dirty, pending: busy });
  }, [dirty, busy, onStateChange]);
  useEffect(
    () => () => {
      onStateChange?.({ dirty: false, pending: false });
    },
    [onStateChange],
  );
}

function useEntryActions(props: Props, fields: EntryFields): EntryActions {
  const uploads = useAssessmentUploads();
  const [sending, setSending] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [discard, setDiscard] = useState(false);
  const busy = fields.form.save.isPending || sending;
  const dirty = fields.changed || fields.pendingCount > 0;
  useEntryNotifications({ onStateChange: props.onStateChange, dirty, busy });
  function requestClose(): void {
    if (busy) return;
    if (dirty) setDiscard(true);
    else props.onClose();
  }
  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    if (fields.changed) {
      const saved = await fields.form.submit(event);
      if (!saved) return;
      fields.setBaseline(saved);
    }
    setSending(true);
    setUploadError("");
    try {
      if (props.competence === "WRITTEN" || props.competence === "LISTENING")
        await uploadDrafts({
          attachments: fields.attachments,
          add: uploads.add,
          data: props.data,
          competence: props.competence,
          setAttachments: fields.setAttachments,
        });
      props.onSaved(
        fields.pendingCount ? "Salvo. Os arquivos estão na fila de envio." : "Avaliação salva.",
      );
      props.onClose();
    } catch (error) {
      setUploadError(
        "Os arquivos restantes não foram enviados. " +
          (error instanceof Error ? error.message : "Tente salvar novamente."),
      );
    } finally {
      setSending(false);
    }
  }
  return { busy, dirty, uploadError, discard, setDiscard, requestClose, submit };
}

function PhaseControl({ fields, busy }: { fields: EntryFields; busy: boolean }): ReactJSX.Element {
  return (
    <Field>
      <Label id={fields.id + "-unit"}>Unidade</Label>
      <SegmentedControl
        value={fields.phase}
        size="sm"
        className="w-full sm:w-fit"
        aria-labelledby={fields.id + "-unit"}
        disabled={busy}
        onValueChange={(next) => {
          if (next) fields.setPhase(next as Phase);
        }}
      >
        {PHASES.map((item) => (
          <SegmentedControlItem
            key={item}
            value={item}
            className="flex-1 px-1.5 sm:flex-none sm:px-2.5"
          >
            {PHASE_LABELS[item]}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </Field>
  );
}

function NotesField({ fields, busy }: { fields: EntryFields; busy: boolean }): ReactJSX.Element {
  const error = fields.form.errors["grades." + fields.index + ".notes"];
  return (
    <Field>
      <Label htmlFor={fields.id + "-notes"}>
        Observações <span className="font-normal text-muted-foreground">(opcional)</span>
      </Label>
      <Textarea
        id={fields.id + "-notes"}
        size="sm"
        rows={2}
        maxLength={2000}
        value={fields.grade.notes}
        disabled={busy}
        placeholder="Registre o que precisa ser acompanhado."
        invalid={Boolean(error)}
        onChange={(event) =>
          fields.form.change({ index: fields.index, field: "notes", value: event.target.value })
        }
      />
      <FieldError match={Boolean(error)}>{error}</FieldError>
    </Field>
  );
}

function ProofFields({
  fields,
  busy,
}: {
  fields: EntryFields;
  busy: boolean;
}): ReactJSX.Element | null {
  if (!fields.proof) return null;
  return (
    <div className={styles.proof}>
      <FileUpload
        key={fields.phase}
        compact
        value={fields.selected}
        disabled={busy}
        multiple
        camera
        accept="application/pdf,image/jpeg,image/png"
        acceptLabel="PDF, JPG ou PNG"
        maxSize={MAX_UPLOAD_FILE_BYTES}
        onValueChange={(next) =>
          fields.setAttachments((current) => [
            ...current.filter((row) => row.phase !== fields.phase),
            { phase: fields.phase, files: next },
          ])
        }
      />
      {fields.filesPending && <PencilLoader size="sm" label="Consultando arquivos" />}
      {fields.filesError && (
        <ToastAlert variant="destructive">
          Não foi possível consultar os arquivos.
          <Button size="sm" variant="ghost" onClick={fields.refreshFiles}>
            <RotateCcw aria-hidden="true" />
            Tentar novamente
          </Button>
        </ToastAlert>
      )}
      {fields.existing.length > 0 && (
        <FileList rows={fields.existing} showPhase={false} refresh={fields.refreshFiles} />
      )}
    </div>
  );
}

function CorrectionField({
  fields,
  data,
  busy,
}: {
  fields: EntryFields;
  data: Assessment;
  busy: boolean;
}): ReactJSX.Element | null {
  if (!data.confirmedAt || !fields.gradeChanged) return null;
  const error = fields.form.errors.correctionReason;
  return (
    <Field>
      <Label htmlFor={fields.id + "-correction"}>Justificativa da correção</Label>
      <Input
        id={fields.id + "-correction"}
        size="dense"
        value={fields.form.reason}
        disabled={busy}
        onChange={(event) => fields.form.setReason(event.target.value)}
        invalid={Boolean(error)}
      />
      <FieldError match={Boolean(error)}>{error}</FieldError>
      <p className={styles.hint}>A alteração da nota precisa de nova confirmação da coordenação.</p>
    </Field>
  );
}

function EntryForm({ fields, actions, props }: EntryModel): ReactJSX.Element {
  return (
    <div ref={fields.form.body}>
      <form
        id={fields.id}
        className={styles.entry}
        noValidate
        onSubmit={(event) => {
          void actions.submit(event);
        }}
      >
        <PhaseControl fields={fields} busy={actions.busy} />
        <AssessmentGradeFields
          id={fields.id}
          grade={fields.grade}
          index={fields.index}
          errors={fields.form.errors}
          disabled={actions.busy}
          className={styles.fields}
          onChange={(field, value) => fields.form.change({ index: fields.index, field, value })}
        />
        <NotesField fields={fields} busy={actions.busy} />
        <ProofFields fields={fields} busy={actions.busy} />
        <CorrectionField fields={fields} data={props.data} busy={actions.busy} />
        {fields.form.save.error && (
          <ToastAlert variant="destructive">{fields.form.save.error.message}</ToastAlert>
        )}
        {actions.uploadError && (
          <ToastAlert variant="destructive">{actions.uploadError}</ToastAlert>
        )}
      </form>
    </div>
  );
}

function EntryFooter({
  fields,
  actions,
}: Pick<EntryModel, "fields" | "actions">): ReactJSX.Element {
  return (
    <DialogFooter className="mt-3 flex-row justify-end gap-2">
      <Button size="sm" variant="secondary" disabled={actions.busy} onClick={actions.requestClose}>
        <X aria-hidden="true" />
        Cancelar
      </Button>
      <Button
        size="sm"
        type="submit"
        form={fields.id}
        loading={actions.busy}
        disabled={!actions.dirty}
      >
        <Save aria-hidden="true" />
        Salvar
      </Button>
    </DialogFooter>
  );
}

function EntryDialogContent(model: EntryModel): ReactJSX.Element {
  const { props, fields, actions } = model;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) actions.requestClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className="p-4 md:max-w-lg"
          showCloseButton={!actions.busy}
          finalFocus={() => props.trigger}
        >
          <DialogHeader className="gap-1">
            <DialogTitle className="text-base">{COMPETENCE_LABELS[props.competence]}</DialogTitle>
            <DialogDescription>
              {props.data.student.fullName} · {props.data.stage.name}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="-mx-4 px-4">
            <EntryForm {...model} />
          </DialogBody>
          <EntryFooter fields={fields} actions={actions} />
        </DialogContent>
        {actions.discard && (
          <DiscardRegistrationDialog
            onKeep={() => actions.setDiscard(false)}
            onDiscard={props.onClose}
          />
        )}
      </DialogPortal>
    </Dialog>
  );
}

export function AssessmentEntryDialog(props: Props): ReactJSX.Element {
  const fields = useEntryFields(props);
  const actions = useEntryActions(props, fields);
  return <EntryDialogContent props={props} fields={fields} actions={actions} />;
}
