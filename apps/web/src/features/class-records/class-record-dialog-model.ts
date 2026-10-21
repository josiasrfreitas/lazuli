"use client";
import { useState } from "react";
import { trpc } from "~/lib/trpc";
import type { AttendanceStatus } from "~/features/student-attendance/staff-section";
import type { ClassRecord } from "./shared";
const DECLARATION_POLL_MS = 5000;
const RECORD_POLL_MS = 30_000;
export type LessonDialogProps = { id: string; onClose: () => void; initialEditing?: boolean };
type EditorState = { dirty: boolean; pending: boolean };
export type LessonDialogModel = {
  props: LessonDialogProps;
  teacher: boolean;
  editing: boolean;
  setEditing: (value: boolean) => void;
  editorState: EditorState;
  setEditorState: (value: EditorState) => void;
  discard: boolean;
  setDiscard: (value: boolean) => void;
  requestClose: () => void;
  query: ReturnType<typeof trpc.classRecords.detail.useQuery<ClassRecord>>;
  attendance: ReturnType<typeof trpc.studentAttendance.status.useQuery<AttendanceStatus>>;
  finish: () => void;
};
export function useLessonDialog(props: LessonDialogProps): LessonDialogModel {
  const me = trpc.me.useQuery();
  const teacher = me.data?.role === "TEACHER";
  const [editing, setEditing] = useState(props.initialEditing ?? false);
  const [editorState, setEditorState] = useState<EditorState>({ dirty: false, pending: false });
  const [discard, setDiscard] = useState(false);
  const attendance = trpc.studentAttendance.status.useQuery(
    { sessionId: props.id },
    { enabled: teacher, refetchInterval: DECLARATION_POLL_MS },
  );
  const query = trpc.classRecords.detail.useQuery(
    { sessionId: props.id },
    {
      retry: false,
      refetchInterval: (query) =>
        query.state.data?.version === 0 ? DECLARATION_POLL_MS : RECORD_POLL_MS,
    },
  );
  function requestClose(): void {
    if (editorState.pending) return;
    if (editorState.dirty) setDiscard(true);
    else props.onClose();
  }
  function finish(): void {
    setEditing(false);
    setEditorState({ dirty: false, pending: false });
  }
  return {
    props,
    teacher,
    editing,
    setEditing,
    editorState,
    setEditorState,
    discard,
    setDiscard,
    requestClose,
    query,
    attendance,
    finish,
  };
}
