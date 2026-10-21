"use client";
import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { classRecordSaveSchema, type ClassRecordSave } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { contentInput, draftContent, type ContentDraft } from "./content-fields";
import type { ClassRecord } from "./shared";
type Setter<T> = Dispatch<SetStateAction<T>>;
type DraftRow = ClassRecord["snapshot"]["entries"][number] & { draft: ContentDraft };
type Draft = {
  opened: ClassRecord;
  regular: boolean;
  rows: DraftRow[];
  setRows: Setter<DraftRow[]>;
  selected: string | undefined;
  setSelected: Setter<string | undefined>;
  shared: ContentDraft;
  setShared: Setter<ContentDraft>;
  note: string;
  setNote: Setter<string>;
  reason: string;
  setReason: Setter<string>;
  dirty: boolean;
};
export type RecordEditor = Draft & {
  errors: Record<string, string>;
  clearError: (name: string) => void;
  review: ClassRecordSave | null;
  setReview: Setter<ClassRecordSave | null>;
  save: ReturnType<typeof trpc.classRecords.save.useMutation>;
  focus: (id: string) => void;
  prepare: () => void;
  present: number;
  needsReason: boolean;
  active: DraftRow | undefined;
};
function useDraft(data: ClassRecord): Draft {
  const [opened] = useState(data);
  const regular = opened.session.scheduleType === "REGULAR";
  const [rows, setRows] = useState(() =>
    opened.snapshot.entries.map((row) => ({ ...row, draft: draftContent(row.content) })),
  );
  const [selected, setSelected] = useState(
    rows.find((row) => row.status === "PRESENT")?.enrollmentId ?? rows[0]?.enrollmentId,
  );
  const [shared, setShared] = useState(draftContent(opened.snapshot.sharedContent));
  const [note, setNote] = useState(opened.snapshot.note ?? "");
  const [reason, setReason] = useState("");
  const serialized = JSON.stringify({ rows, shared, note, reason });
  const [initial] = useState(serialized);
  return {
    opened,
    regular,
    rows,
    setRows,
    selected,
    setSelected,
    shared,
    setShared,
    note,
    setNote,
    reason,
    setReason,
    dirty: serialized !== initial,
  };
}
function useEditorFocus(dirty: boolean): (id: string) => void {
  const [field, setField] = useState<{ id: string } | null>(null);
  useEffect(() => {
    document.querySelector<HTMLElement>("#presence-first")?.focus();
  }, []);
  useEffect(() => {
    if (field)
      document
        .querySelector<HTMLElement>(`#${CSS.escape(field.id)}, [name="${CSS.escape(field.id)}"]`)
        ?.focus();
  }, [field]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return (id) => setField({ id });
}
function correctionRequired(draft: Draft): boolean {
  if (draft.opened.version > 0) return true;
  if (!draft.opened.attendanceOnly) return false;
  return draft.rows.some(
    (row) =>
      draft.opened.snapshot.entries.find((original) => original.enrollmentId === row.enrollmentId)
        ?.status !== row.status,
  );
}
function recordInput(draft: Draft): object {
  const present = draft.rows.some((row) => row.status === "PRESENT");
  return {
    sessionId: draft.opened.session.id,
    version: draft.opened.version,
    attendanceStamp: draft.opened.attendanceStamp,
    sharedContent: draft.regular && present ? contentInput(draft.shared) : null,
    rows: draft.rows.map((row) => ({
      enrollmentId: row.enrollmentId,
      status: row.status,
      content: !draft.regular && row.status === "PRESENT" ? contentInput(row.draft) : null,
    })),
    note: draft.note.trim() || null,
    ...(correctionRequired(draft) ? { reason: draft.reason } : {}),
  };
}
function fieldKey(path: PropertyKey[], rows: DraftRow[]): string {
  if (path[0] === "rows") return `${rows[Number(path[1])]?.enrollmentId}-${String(path.at(-1))}`;
  if (path[0] === "sharedContent") return `shared-${String(path.at(-1))}`;
  return String(path[0]);
}
const MIN_REASON = 3;
function parseRecord(draft: Draft): {
  errors: Record<string, string>;
  value: ClassRecordSave | null;
} {
  const parsed = classRecordSaveSchema.safeParse(recordInput(draft));
  const errors: Record<string, string> = {};
  if (!parsed.success)
    for (const issue of parsed.error.issues)
      errors[fieldKey(issue.path, draft.rows)] = issue.message;
  if (correctionRequired(draft) && draft.reason.trim().length < MIN_REASON)
    errors.reason = "Explique o motivo da correção.";
  if (!draft.rows.some((row) => row.status === "PRESENT") && !draft.note.trim())
    errors.note = "Explique a aula sem alunos presentes.";
  return { errors, value: parsed.success ? parsed.data : null };
}
export function useRecordEditor(data: ClassRecord, onClose: () => void): RecordEditor {
  const draft = useDraft(data);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [review, setReview] = useState<ClassRecordSave | null>(null);
  const focus = useEditorFocus(draft.dirty);
  const utils = trpc.useUtils();
  const save = trpc.classRecords.save.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.classRecords.invalidate(),
        utils.students.invalidate(),
        utils.classes.invalidate(),
        utils.planning.invalidate(),
      ]);
      setReview(null);
      onClose();
    },
  });
  const prepare = (): void => {
    const parsed = parseRecord(draft);
    setErrors(parsed.errors);
    const first = Object.keys(parsed.errors)[0];
    if (first) {
      const student = draft.rows.find((row) => first.startsWith(row.enrollmentId));
      if (student) draft.setSelected(student.enrollmentId);
      focus(first);
      return;
    }
    if (parsed.value) {
      save.reset();
      setReview(parsed.value);
    }
  };
  return {
    ...draft,
    clearError: (name) =>
      setErrors((current) =>
        Object.fromEntries(Object.entries(current).filter(([key]) => key !== name)),
      ),
    errors,
    review,
    setReview,
    focus,
    save,
    prepare,
    present: draft.rows.filter((row) => row.status === "PRESENT").length,
    needsReason: correctionRequired(draft),
    active: draft.rows.find((row) => row.enrollmentId === draft.selected),
  };
}
