"use client";

import { useState, type ReactElement } from "react";
import Link from "next/link";
import { ArrowUpRight, ClipboardCheck, Pencil, X } from "lucide-react";
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
}: {
  id: string;
  onClose: () => void;
  initialEditing?: boolean;
}): ReactElement {
  const me = trpc.me.useQuery();
  const teacher = me.data?.role === "TEACHER";
  const [editing, setEditing] = useState(initialEditing);
  const [editorState, setEditorState] = useState({ dirty: false, pending: false });
  const [discard, setDiscard] = useState(false);
  const requestClose = () => {
    if (editorState.pending) return;
    if (editorState.dirty) setDiscard(true);
    else onClose();
  };
  const attendance = trpc.studentAttendance.status.useQuery(
    { sessionId: id },
    { enabled: teacher, refetchInterval: 5_000 },
  );
  const query = trpc.classRecords.detail.useQuery(
    { sessionId: id },
    { retry: false, refetchInterval: 30_000 },
  );
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
          className="md:max-w-6xl md:w-[calc(100%-2rem)]"
          showCloseButton={!editorState.pending}
        >
          {query.data ? (
            <LessonHeader data={query.data} />
          ) : query.isPending ? (
            <LessonLoadingHeader />
          ) : (
            <DialogHeader>
              <DialogTitle className="text-base">Detalhes da aula</DialogTitle>
            </DialogHeader>
          )}
          <DialogBody aria-busy={query.isPending}>
            {query.isPending ? (
              <LessonLoadingList />
            ) : (
              <RecordState pending={false} error={query.error} retry={() => void query.refetch()} />
            )}
            {query.data && (
              <div className="grid min-w-0 gap-5">
                {teacher && !editing && <StudentAttendanceSection sessionId={id} />}
                {editing ? (
                  <ClassRecordEditor
                    key={id}
                    data={query.data}
                    declarations={attendance.data?.declarations ?? query.data.declarations}
                    externalSubmit
                    onStateChange={setEditorState}
                    onClose={() => {
                      setEditing(false);
                      setEditorState({ dirty: false, pending: false });
                    }}
                  />
                ) : (
                  <LessonDetails key={id} data={query.data} />
                )}
                {teacher && query.data.restriction && <Alert>{query.data.restriction}</Alert>}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={requestClose} disabled={editorState.pending}>
              <X aria-hidden="true" />
              Fechar
            </Button>
            {query.data && !editing && (
              <Button
                variant="link"
                nativeButton={false}
                render={
                  <Link
                    href={`${teacher ? "/professor" : ""}/turmas/${query.data.session.classId}`}
                  />
                }
              >
                Ver turma
                <ArrowUpRight aria-hidden="true" />
              </Button>
            )}
            {teacher && query.data && !query.data.restriction && !editing && (
              <Button onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                {query.data.version ? "Corrigir registro" : "Registrar aula"}
              </Button>
            )}
            {editing && (
              <Button type="submit" form="class-record-editor" disabled={editorState.pending}>
                <ClipboardCheck aria-hidden="true" />
                {query.data?.version ? "Conferir correção" : "Conferir e dar baixa"}
              </Button>
            )}
          </DialogFooter>
          {discard && (
            <DiscardRegistrationDialog onKeep={() => setDiscard(false)} onDiscard={onClose} />
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function LessonHeader({ data }: { data: ClassRecord }): ReactElement {
  const { session } = data;
  const regular = session.scheduleType === "REGULAR";
  const recorded = data.version > 0 || data.attendanceOnly;
  const status = session.cancelled
    ? "Cancelada"
    : recorded
      ? "Presença registrada"
      : session.upcoming
        ? "Agendada"
        : "Presença não registrada";
  const substitute = session.usualTeacher && session.usualTeacher !== session.teacher;
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
      <dl className={styles.context}>
        <div>
          <dt>{substitute ? "Professores" : "Professor"}</dt>
          <dd>{session.teacher ?? "A definir"}</dd>
          {substitute && <dd className={styles.supporting}>Titular: {session.usualTeacher}</dd>}
        </div>
        <div>
          <dt>Turma</dt>
          <dd>
            {regular ? `Regular${session.stageName ? ` · ${session.stageName}` : ""}` : "PPT"}
          </dd>
          {regular && (
            <dd className={styles.supporting}>
              <CoveredPages data={data} />
            </dd>
          )}
        </div>
      </dl>
    </DialogHeader>
  );
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
