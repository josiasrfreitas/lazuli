"use client";
import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { classRecordSaveSchema, type ClassRecordSave } from "@lazuli/validators";
import { applyQrReview } from "./qr-review";
import { trpc } from "~/lib/trpc";
import { contentInput, draftContent, type ContentDraft } from "./content-fields";
import type { ClassRecord } from "./shared";
type Setter<T> = Dispatch<SetStateAction<T>>;
type DraftRow = ClassRecord["snapshot"]["entries"][number] & {
  draft: ContentDraft;
  reviewed: boolean;
  manuallyReviewed: boolean;
};
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
  newDeclarationCount: number;
  reviewDeclarations: () => void;
};
function useDraft(data: ClassRecord): Draft {
  const [opened] = useState(data);
  const regular = opened.session.scheduleType === "REGULAR";
  const [rows, setRows] = useRecordRows(opened, data);
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
    document.querySelector<HTMLElement>("#presence-first, textarea")?.focus();
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
    declarationIds: draft.opened.declarations.map((entry) => entry.id),
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
  for (const row of draft.rows)
    if (!row.reviewed)
      errors["presence-first"] = "Revise a presença dos alunos sem declaração antes de confirmar.";
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
  const declarations = useDeclarationReview(data);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [review, setReview] = useState<ClassRecordSave | null>(null);
  useEffect(() => setReview(null), [data.hasAttendanceWindows, data.declarations.length]);
  const focus = useEditorFocus(draft.dirty);
  const save = useRecordSave(() => {
    setReview(null);
    onClose();
  });
  const prepare = (): void => {
    const parsed = parseRecord(draft);
    setErrors(parsed.errors);
    const first = Object.keys(parsed.errors)[0];
    if (first) {
      focusEditorError(draft, { first, focus });
      return;
    }
    if (parsed.value) {
      save.reset();
      setReview({
        ...parsed.value,
        declarationIds: declarations.ids,
        qrReviewed: data.hasAttendanceWindows,
      });
    }
  };
  return {
    ...draft,
    newDeclarationCount: declarations.count,
    reviewDeclarations: declarations.review,
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

function useDeclarationReview(data: ClassRecord): {
  ids: string[];
  count: number;
  review: () => void;
} {
  const [ids, setIds] = useState(() => data.declarations.map((entry) => entry.id));
  return {
    ids,
    count: data.declarations.filter((entry) => !ids.includes(entry.id)).length,
    review: () => setIds(data.declarations.map((entry) => entry.id)),
  };
}

function focusEditorError(
  draft: Draft,
  input: { first: string; focus: (id: string) => void },
): void {
  const student = draft.rows.find((row) => input.first.startsWith(row.enrollmentId));
  if (student) draft.setSelected(student.enrollmentId);
  input.focus(input.first);
}

function useRecordSave(onSuccess: () => void): RecordEditor["save"] {
  const utils = trpc.useUtils();
  return trpc.classRecords.save.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      onSuccess();
    },
  });
}

function useRecordRows(opened: ClassRecord, live: ClassRecord): [DraftRow[], Setter<DraftRow[]>] {
  const [rows, setRows] = useState(() =>
    opened.snapshot.entries.map((row) => {
      const declared = opened.declarations.some((entry) => entry.enrollmentId === row.enrollmentId);
      const needsReview = opened.hasAttendanceWindows && !opened.version && !opened.attendanceOnly;
      return {
        ...row,
        status: needsReview && !declared ? ("ABSENT" as const) : row.status,
        reviewed: !needsReview || declared,
        manuallyReviewed: false,
        draft: draftContent(row.content),
      };
    }),
  );
  const [qrReviewed, setQrReviewed] = useState(opened.hasAttendanceWindows);
  useEffect(() => {
    if (qrReviewed || !live.hasAttendanceWindows || opened.version || opened.attendanceOnly) return;
    setRows((current) =>
      applyQrReview(
        current,
        live.declarations.map((entry) => entry.enrollmentId),
      ),
    );
    setQrReviewed(true);
  }, [
    live.hasAttendanceWindows,
    live.declarations,
    opened.version,
    opened.attendanceOnly,
    qrReviewed,
  ]);
  return [rows, setRows];
}
