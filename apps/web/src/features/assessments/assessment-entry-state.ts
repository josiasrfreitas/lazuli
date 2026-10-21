import { useEffect, useId, useState } from "react";
import { trpc } from "~/lib/trpc";
import { useAssessmentUploads } from "~/features/assessment-files/queue-provider";
import { useAssessmentForm, type AssessmentFormState } from "./use-assessment-form";
import type {
  AttachmentDraft,
  EntryDraft,
  EntryProps,
  EntryState,
  EntryValues,
} from "./assessment-entry.types";
import type { FileRow } from "~/features/assessment-files/attachments";
const FILE_POLL_MS = 5000;
function useEntryDraft(
  form: AssessmentFormState,
  initialPhase: EntryProps["initialPhase"],
): EntryDraft {
  const [phase, setPhase] = useState(initialPhase);
  const [baseline, setBaseline] = useState(form.grades);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [sending, setSending] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [discard, setDiscard] = useState(false);
  return {
    phase,
    setPhase,
    baseline,
    setBaseline,
    attachments,
    setAttachments,
    sending,
    setSending,
    uploadError,
    setUploadError,
    discard,
    setDiscard,
  };
}
export function useAssessmentEntry(props: EntryProps): EntryState {
  const id = useId();
  const form = useAssessmentForm(props.data);
  const uploads = useAssessmentUploads();
  const proof = props.competence === "WRITTEN" || props.competence === "LISTENING";
  const files = trpc.assessmentFiles.list.useQuery(
    { progressId: props.data.progressId },
    { enabled: proof, refetchInterval: proof ? FILE_POLL_MS : false },
  );
  const draft = useEntryDraft(form, props.initialPhase);
  const values = entryValues(form, { draft, competence: props.competence, files: files.data });
  const state = { ...props, ...draft, ...values, id, form, proof, files };
  useEntryNotifications(state);
  return {
    ...state,
    requestClose: () => {
      if (state.busy) return;
      if (state.dirty) state.setDiscard(true);
      else state.onClose();
    },
    submit: entrySubmit({ ...state, uploads }),
  };
}
function entryValues(
  form: AssessmentFormState,
  {
    draft,
    competence,
    files,
  }: { draft: EntryDraft; competence: EntryProps["competence"]; files: FileRow[] | undefined },
): Pick<
  EntryValues,
  | "changed"
  | "gradeChanged"
  | "pendingCount"
  | "busy"
  | "dirty"
  | "index"
  | "grade"
  | "selected"
  | "existing"
> {
  const changed = JSON.stringify(form.grades) !== JSON.stringify(draft.baseline);
  const gradeChanged = form.grades.some((grade, index) => {
    const previous = draft.baseline[index]!;
    return (
      grade.score !== previous.score ||
      grade.date !== previous.date ||
      grade.reason !== previous.reason
    );
  });
  const pendingCount = draft.attachments.reduce((count, item) => count + item.files.length, 0);
  const busy = form.save.isPending || draft.sending;
  const index = form.grades.findIndex(
    (row) => row.phase === draft.phase && row.competence === competence,
  );
  return {
    changed,
    gradeChanged,
    pendingCount,
    busy,
    dirty: changed || pendingCount > 0,
    index,
    grade: form.grades[index]!,
    selected: draft.attachments.find((row) => row.phase === draft.phase)?.files ?? [],
    existing:
      files?.filter((row) => row.phase === draft.phase && row.competence === competence) ?? [],
  };
}
function useEntryNotifications(state: EntryValues): void {
  const { onStateChange, dirty, busy, form, competence, setPhase } = state;
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
    const key = Object.keys(form.errors).find(
      (key) => form.errors[key] && key.startsWith("grades."),
    );
    const invalid = key ? form.grades[Number(key.split(".")[1])] : null;
    if (invalid?.competence === competence) setPhase(invalid.phase);
  }, [form.errors, form.grades, competence]);
}
type Submission = EntryValues & { uploads: ReturnType<typeof useAssessmentUploads> };
function entrySubmit(state: Submission): EntryState["submit"] {
  return async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (state.busy) return;
    if (state.changed) {
      const saved = await state.form.submit(event);
      if (!saved) return;
      state.setBaseline(saved);
    }
    state.setSending(true);
    state.setUploadError("");
    try {
      if (state.proof) await queueProofDrafts(state);
      state.onSaved(
        state.pendingCount ? "Salvo. Os arquivos estão na fila de envio." : "Avaliação salva.",
      );
      state.onClose();
    } catch (error) {
      state.setUploadError(
        `Os arquivos restantes não foram enviados. ${error instanceof Error ? error.message : "Tente salvar novamente."}`,
      );
    } finally {
      state.setSending(false);
    }
  };
}
async function queueProofDrafts(state: Submission): Promise<void> {
  for (const draft of state.attachments) {
    for (const file of draft.files) {
      await state.uploads.add([file], {
        progressId: state.data.progressId,
        phase: draft.phase,
        competence: state.competence as "WRITTEN" | "LISTENING",
      });
      state.setAttachments((current) =>
        current.map((row) =>
          row.phase === draft.phase
            ? { ...row, files: row.files.filter((item) => item !== file) }
            : row,
        ),
      );
    }
  }
}
