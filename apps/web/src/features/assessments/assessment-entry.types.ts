import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { trpc } from "~/lib/trpc";
import type { FileRow } from "~/features/assessment-files/attachments";
import type { AssessmentFormState, GradeDraft } from "./use-assessment-form";
import type { Assessment, Competence, Phase } from "./shared";
export type EntryProps = {
  data: Assessment;
  competence: Competence;
  initialPhase: Phase;
  trigger: HTMLButtonElement;
  onStateChange?: ((state: { dirty: boolean; pending: boolean }) => void) | undefined;
  onSaved: (notice: string) => void;
  onClose: () => void;
};
export type AttachmentDraft = { phase: Phase; files: File[] };
export type EntryDraft = {
  phase: Phase;
  setPhase: Dispatch<SetStateAction<Phase>>;
  baseline: GradeDraft[];
  setBaseline: Dispatch<SetStateAction<GradeDraft[]>>;
  attachments: AttachmentDraft[];
  setAttachments: Dispatch<SetStateAction<AttachmentDraft[]>>;
  sending: boolean;
  setSending: Dispatch<SetStateAction<boolean>>;
  uploadError: string;
  setUploadError: Dispatch<SetStateAction<string>>;
  discard: boolean;
  setDiscard: Dispatch<SetStateAction<boolean>>;
};
export type EntryValues = EntryProps &
  EntryDraft & {
    id: string;
    form: AssessmentFormState;
    proof: boolean;
    files: ReturnType<typeof trpc.assessmentFiles.list.useQuery>;
    changed: boolean;
    gradeChanged: boolean;
    pendingCount: number;
    busy: boolean;
    dirty: boolean;
    index: number;
    grade: GradeDraft;
    selected: File[];
    existing: FileRow[];
  };
export type EntryState = EntryValues & {
  requestClose: () => void;
  submit: (event: FormEvent) => Promise<void>;
};
