"use client";

import { useState, type Dispatch, type ReactElement, type SetStateAction } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ClipboardCheck, Pencil, X } from "lucide-react";
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
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { LessonDetails } from "./lesson-details";
import { LessonLoadingHeader, LessonLoadingList } from "./lesson-loading";
import { RecordState, type ClassRecord } from "./shared";
import styles from "./class-record-dialog.module.css";
import { ClassRecordEditor } from "./editor";
import { StudentAttendanceSection } from "~/features/student-attendance/staff-section";
import { DiscardRegistrationDialog } from "~/features/shared/discard-registration-dialog";

export function ClassRecordDialog({
  id,
  onClose,
  initialEditing = false,
  embedded = false,
}: {
  id: string;
  onClose: () => void;
  initialEditing?: boolean;
  embedded?: boolean;
}): ReactElement {
  const me = trpc.me.useQuery();
  const teacher = me.data?.role === "TEACHER";
  const editor = useClassRecordEditor(initialEditing, onClose);
  const attendance = trpc.studentAttendance.status.useQuery(
    { sessionId: id },
    { enabled: teacher, refetchInterval: 5000 },
  );
  const query = trpc.classRecords.detail.useQuery(
    { sessionId: id },
    { retry: false, refetchInterval: 30_000 },
  );
  const panel = (
    <ClassRecordPanel
      id={id}
      teacher={teacher}
      data={query.data}
      pending={query.isPending}
      error={query.error}
      retry={() => void query.refetch()}
      declarations={attendance.data?.declarations ?? query.data?.declarations}
      editor={editor}
      onClose={onClose}
      embedded={embedded}
    />
  );
  if (embedded) return panel;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) editor.requestClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className="md:max-w-6xl md:w-[calc(100%-2rem)]"
          showCloseButton={!editor.editorState.pending}
        >
          {panel}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

type PanelProps = {
  id: string;
  teacher: boolean;
  data: ClassRecord | undefined;
  pending: boolean;
  error: { message: string } | null;
  retry: () => void;
  declarations: ClassRecord["declarations"] | undefined;
  editor: EditorControls;
  onClose: () => void;
  embedded: boolean;
};
function ClassRecordPanel({
  id,
  teacher,
  data,
  pending,
  error,
  retry,
  declarations,
  editor,
  onClose,
  embedded,
}: PanelProps): ReactElement {
  return (
    <>
      {embedded && (
        <div className="mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={editor.requestClose}
            disabled={editor.editorState.pending}
          >
            <ArrowLeft aria-hidden="true" /> Voltar à agenda
          </Button>
        </div>
      )}
      <ClassRecordHeader data={data} pending={pending} />
      <ClassRecordBody {...{ id, teacher, data, pending, error, retry, declarations, editor }} />
      <ClassRecordActions data={data} teacher={teacher} editor={editor} />
      {editor.discard && (
        <DiscardRegistrationDialog onKeep={() => editor.setDiscard(false)} onDiscard={onClose} />
      )}
    </>
  );
}

function ClassRecordHeader({
  data,
  pending,
}: {
  data: ClassRecord | undefined;
  pending: boolean;
}): ReactElement {
  if (data) return <LessonHeader data={data} />;
  if (pending) return <LessonLoadingHeader />;
  return (
    <DialogHeader>
      <DialogTitle className="text-base">Detalhes da aula</DialogTitle>
    </DialogHeader>
  );
}

type EditorState = { dirty: boolean; pending: boolean };
type EditorControls = {
  editing: boolean;
  setEditing: Dispatch<SetStateAction<boolean>>;
  editorState: EditorState;
  setEditorState: Dispatch<SetStateAction<EditorState>>;
  discard: boolean;
  setDiscard: Dispatch<SetStateAction<boolean>>;
  requestClose: () => void;
};
function useClassRecordEditor(initialEditing: boolean, onClose: () => void): EditorControls {
  const [editing, setEditing] = useState(initialEditing);
  const [editorState, setEditorState] = useState<EditorState>({ dirty: false, pending: false });
  const [discard, setDiscard] = useState(false);
  const requestClose = (): void => {
    if (editorState.pending) return;
    if (editorState.dirty) setDiscard(true);
    else onClose();
  };
  return { editing, setEditing, editorState, setEditorState, discard, setDiscard, requestClose };
}

function ClassRecordBody({
  id,
  teacher,
  data,
  pending,
  error,
  retry,
  declarations,
  editor,
}: {
  id: string;
  teacher: boolean;
  data: ClassRecord | undefined;
  pending: boolean;
  error: { message: string } | null;
  retry: () => void;
  declarations: ClassRecord["declarations"] | undefined;
  editor: EditorControls;
}): ReactElement {
  return (
    <DialogBody aria-busy={pending}>
      {pending ? (
        <LessonLoadingList />
      ) : (
        <RecordState pending={false} error={error} retry={retry} />
      )}
      {data && (
        <div className="grid min-w-0 gap-5">
          {teacher && !editor.editing && <StudentAttendanceSection sessionId={id} />}
          {editor.editing ? (
            <ClassRecordEditor
              key={id}
              data={data}
              declarations={declarations ?? data.declarations}
              externalSubmit
              onStateChange={editor.setEditorState}
              onClose={() => {
                editor.setEditing(false);
                editor.setEditorState({ dirty: false, pending: false });
              }}
            />
          ) : (
            <LessonDetails key={id} data={data} />
          )}
          {teacher && data.restriction && <Alert>{data.restriction}</Alert>}
        </div>
      )}
    </DialogBody>
  );
}

function ClassRecordActions({
  data,
  teacher,
  editor,
}: {
  data: ClassRecord | undefined;
  teacher: boolean;
  editor: EditorControls;
}): ReactElement {
  return (
    <DialogFooter>
      <Button
        variant="secondary"
        onClick={editor.requestClose}
        disabled={editor.editorState.pending}
      >
        <X aria-hidden="true" />
        Fechar
      </Button>
      <ClassRecordActionButtons data={data} teacher={teacher} editor={editor} />
    </DialogFooter>
  );
}

function ClassRecordActionButtons({
  data,
  teacher,
  editor,
}: {
  data: ClassRecord | undefined;
  teacher: boolean;
  editor: EditorControls;
}): ReactElement {
  return (
    <>
      <ClassLinkButton data={data} teacher={teacher} editing={editor.editing} />
      <TeacherRecordButton data={data} teacher={teacher} editor={editor} />
      {editor.editing && (
        <Button type="submit" form="class-record-editor" disabled={editor.editorState.pending}>
          <ClipboardCheck aria-hidden="true" />
          {data?.version ? "Conferir correção" : "Conferir e dar baixa"}
        </Button>
      )}
    </>
  );
}

function ClassLinkButton({
  data,
  teacher,
  editing,
}: {
  data: ClassRecord | undefined;
  teacher: boolean;
  editing: boolean;
}): ReactElement | null {
  if (!data || editing) return null;
  return (
    <Button
      variant="link"
      nativeButton={false}
      render={<Link href={`${teacher ? "/professor" : ""}/turmas/${data.session.classId}`} />}
    >
      Ver turma <ArrowUpRight aria-hidden="true" />
    </Button>
  );
}

function TeacherRecordButton({
  data,
  teacher,
  editor,
}: {
  data: ClassRecord | undefined;
  teacher: boolean;
  editor: EditorControls;
}): ReactElement | null {
  if (!teacher || !data || data.restriction || editor.editing) return null;
  return (
    <Button onClick={() => editor.setEditing(true)}>
      <Pencil aria-hidden="true" />
      {data.version ? "Corrigir registro" : "Registrar aula"}
    </Button>
  );
}

function LessonHeader({ data }: { data: ClassRecord }): ReactElement {
  const { session } = data;
  const recorded = data.version > 0 || data.attendanceOnly;
  const status = lessonStatus(session, recorded);
  return (
    <DialogHeader>
      <div className={styles.headingRow}>
        <div className={styles.title}>
          <DialogTitle className="text-base">{session.className}</DialogTitle>
          <Badge variant={recorded && !session.cancelled ? "success" : "neutral"}>{status}</Badge>
        </div>
        <DialogDescription>
          <time dateTime={session.date}>{formatDateOnlyBR(session.date)}</time>
          {` · ${session.startTime}–${session.endTime} · ${session.format === "ONLINE" ? "Online" : "Presencial"}`}
        </DialogDescription>
      </div>
      <LessonContext data={data} />
    </DialogHeader>
  );
}

function LessonContext({ data }: { data: ClassRecord }): ReactElement {
  const { session } = data;
  const regular = session.scheduleType === "REGULAR";
  const substitute = session.usualTeacher && session.usualTeacher !== session.teacher;
  return (
    <dl className={styles.context}>
      <div>
        <dt>{substitute ? "Professores" : "Professor"}</dt>
        <dd>{session.teacher ?? "A definir"}</dd>
        {substitute && <dd className={styles.supporting}>Titular: {session.usualTeacher}</dd>}
      </div>
      <div>
        <dt>Turma</dt>
        <dd>{regular ? `Regular${session.stageName ? ` · ${session.stageName}` : ""}` : "PPT"}</dd>
        {regular && (
          <dd className={styles.supporting}>
            <CoveredPages data={data} />
          </dd>
        )}
      </div>
    </dl>
  );
}

function lessonStatus(session: ClassRecord["session"], recorded: boolean): string {
  if (session.cancelled) return "Cancelada";
  if (recorded) return "Presença registrada";
  if (session.upcoming) return "Agendada";
  return "Presença não registrada";
}

function CoveredPages({ data }: { data: ClassRecord }): ReactElement {
  const content = data.snapshot.sharedContent;
  if (!content) return <>Conteúdo ainda não registrado</>;
  const pages =
    content.pageFrom === null
      ? null
      : `Pág. ${content.pageFrom}${content.pageTo !== null && content.pageTo !== content.pageFrom ? `–${content.pageTo}` : ""}`;
  return <span title={content.reference ?? undefined}>{pages ?? "Páginas não informadas"}</span>;
}
