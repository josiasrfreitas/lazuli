"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { RotateCcw, Save, X } from "lucide-react";
import { MAX_UPLOAD_FILE_BYTES } from "@lazuli/validators";
import {
  Alert,
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
import { useAssessmentForm } from "./use-assessment-form";
import {
  COMPETENCE_LABELS,
  PHASE_LABELS,
  PHASES,
  type Assessment,
  type Competence,
  type Phase,
} from "./shared";
import styles from "./assessment-workspace.module.css";

type AttachmentDraft = { phase: Phase; files: File[] };

export function AssessmentEntryDialog({
  data,
  competence,
  initialPhase,
  trigger,
  onStateChange,
  onSaved,
  onClose,
}: {
  data: Assessment;
  competence: Competence;
  initialPhase: Phase;
  trigger: HTMLButtonElement;
  onStateChange?: ((state: { dirty: boolean; pending: boolean }) => void) | undefined;
  onSaved: (notice: string) => void;
  onClose: () => void;
}) {
  const id = useId();
  const state = useAssessmentForm(data);
  const uploads = useAssessmentUploads();
  const proof = competence === "WRITTEN" || competence === "LISTENING";
  const files = trpc.assessmentFiles.list.useQuery(
    { progressId: data.progressId },
    { enabled: proof, refetchInterval: proof ? 5_000 : false },
  );
  const [phase, setPhase] = useState(initialPhase);
  const [baseline, setBaseline] = useState(state.grades);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [sending, setSending] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [discard, setDiscard] = useState(false);
  const changed = JSON.stringify(state.grades) !== JSON.stringify(baseline);
  const gradeChanged = state.grades.some((grade, index) => {
    const previous = baseline[index]!;
    return (
      grade.score !== previous.score ||
      grade.date !== previous.date ||
      grade.reason !== previous.reason
    );
  });
  const pendingCount = attachments.reduce((count, draft) => count + draft.files.length, 0);
  const busy = state.save.isPending || sending;
  const dirty = changed || pendingCount > 0;
  const index = state.grades.findIndex(
    (row) => row.phase === phase && row.competence === competence,
  );
  const grade = state.grades[index]!;
  const selected = attachments.find((row) => row.phase === phase)?.files ?? [];
  const existing =
    files.data?.filter((row) => row.phase === phase && row.competence === competence) ?? [];

  useEffect(() => {
    onStateChange?.({ dirty, pending: busy });
  }, [dirty, busy, onStateChange]);

  useEffect(
    () => () => {
      onStateChange?.({ dirty: false, pending: false });
    },
    [onStateChange],
  );

  useEffect(() => {
    const key = Object.keys(state.errors).find(
      (key) => state.errors[key] && key.startsWith("grades."),
    );
    const invalid = key ? state.grades[Number(key.split(".")[1])] : null;
    if (invalid?.competence === competence) setPhase(invalid.phase);
  }, [state.errors, state.grades, competence]);

  function requestClose() {
    if (busy) return;
    if (dirty) setDiscard(true);
    else onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    if (changed) {
      const saved = await state.submit(event);
      if (!saved) return;
      setBaseline(saved);
    }
    setSending(true);
    setUploadError("");
    try {
      if (proof)
        for (const draft of attachments) {
          for (const file of draft.files) {
            await uploads.add([file], {
              progressId: data.progressId,
              phase: draft.phase,
              competence,
            });
            setAttachments((current) =>
              current.map((row) =>
                row.phase === draft.phase
                  ? { ...row, files: row.files.filter((item) => item !== file) }
                  : row,
              ),
            );
          }
        }
      onSaved(pendingCount ? "Salvo. Os arquivos estão na fila de envio." : "Avaliação salva.");
      onClose();
    } catch (error) {
      setUploadError(
        `Os arquivos restantes não foram enviados. ${error instanceof Error ? error.message : "Tente salvar novamente."}`,
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className="p-4 md:max-w-lg"
          showCloseButton={!busy}
          finalFocus={() => trigger}
        >
          <DialogHeader className="gap-1">
            <DialogTitle className="text-base">{COMPETENCE_LABELS[competence]}</DialogTitle>
            <DialogDescription>
              {data.student.fullName} · {data.stage.name}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="-mx-4 px-4">
            <div ref={state.body}>
              <form
                id={id}
                className={styles.entry}
                noValidate
                onSubmit={(event) => void submit(event)}
              >
                <Field>
                  <Label id={`${id}-unit`}>Unidade</Label>
                  <SegmentedControl
                    value={phase}
                    size="sm"
                    className="w-full sm:w-fit"
                    aria-labelledby={`${id}-unit`}
                    disabled={busy}
                    onValueChange={(next) => {
                      if (next) setPhase(next as Phase);
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
                <AssessmentGradeFields
                  id={id}
                  grade={grade}
                  index={index}
                  errors={state.errors}
                  disabled={busy}
                  className={styles.fields}
                  onChange={(field, value) => state.change(index, field, value)}
                />
                <Field>
                  <Label htmlFor={`${id}-notes`}>
                    Observações{" "}
                    <span className="font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <Textarea
                    id={`${id}-notes`}
                    size="sm"
                    rows={2}
                    maxLength={2000}
                    value={grade.notes}
                    disabled={busy}
                    placeholder="Registre o que precisa ser acompanhado."
                    invalid={Boolean(state.errors[`grades.${index}.notes`])}
                    onChange={(event) => state.change(index, "notes", event.target.value)}
                  />
                  <FieldError match={Boolean(state.errors[`grades.${index}.notes`])}>
                    {state.errors[`grades.${index}.notes`]}
                  </FieldError>
                </Field>
                {proof && (
                  <div className={styles.proof}>
                    <FileUpload
                      key={phase}
                      compact
                      value={selected}
                      disabled={busy}
                      multiple
                      camera
                      accept="application/pdf,image/jpeg,image/png"
                      acceptLabel="PDF, JPG ou PNG"
                      maxSize={MAX_UPLOAD_FILE_BYTES}
                      onValueChange={(next) =>
                        setAttachments((current) => [
                          ...current.filter((row) => row.phase !== phase),
                          { phase, files: next },
                        ])
                      }
                    />
                    {files.isPending && <PencilLoader size="sm" label="Consultando arquivos" />}
                    {files.error && (
                      <Alert variant="destructive">
                        Não foi possível consultar os arquivos.
                        <Button size="sm" variant="ghost" onClick={() => void files.refetch()}>
                          <RotateCcw aria-hidden="true" />
                          Tentar novamente
                        </Button>
                      </Alert>
                    )}
                    {existing.length > 0 && (
                      <FileList
                        rows={existing}
                        showPhase={false}
                        refresh={() => void files.refetch()}
                      />
                    )}
                  </div>
                )}
                {data.confirmedAt && gradeChanged && (
                  <Field>
                    <Label htmlFor={`${id}-correction`}>Justificativa da correção</Label>
                    <Input
                      id={`${id}-correction`}
                      size="dense"
                      value={state.reason}
                      disabled={busy}
                      onChange={(event) => state.setReason(event.target.value)}
                      invalid={Boolean(state.errors.correctionReason)}
                    />
                    <FieldError match={Boolean(state.errors.correctionReason)}>
                      {state.errors.correctionReason}
                    </FieldError>
                    <p className={styles.hint}>
                      A alteração da nota precisa de nova confirmação da coordenação.
                    </p>
                  </Field>
                )}
                {state.save.error && (
                  <Alert variant="destructive">{state.save.error.message}</Alert>
                )}
                {uploadError && <Alert variant="destructive">{uploadError}</Alert>}
              </form>
            </div>
          </DialogBody>
          <DialogFooter className="mt-3 flex-row justify-end gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={requestClose}>
              <X aria-hidden="true" />
              Cancelar
            </Button>
            <Button size="sm" type="submit" form={id} loading={busy} disabled={!dirty}>
              <Save aria-hidden="true" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
        {discard && (
          <DiscardRegistrationDialog onKeep={() => setDiscard(false)} onDiscard={onClose} />
        )}
      </DialogPortal>
    </Dialog>
  );
}
