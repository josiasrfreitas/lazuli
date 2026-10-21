"use client";
import type { ReactElement } from "react";
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
import { formatDateOnlyBR } from "~/lib/format";
import { LessonDetails } from "./lesson-details";
import { LessonLoadingHeader, LessonLoadingList } from "./lesson-loading";
import { RecordState, type ClassRecord } from "./shared";
import { ClassRecordEditor } from "./editor";
import { StudentAttendanceSection } from "~/features/student-attendance/staff-section";
import { DiscardRegistrationDialog } from "~/features/shared/discard-registration-dialog";
import {
  useLessonDialog,
  type LessonDialogModel,
  type LessonDialogProps,
} from "./class-record-dialog-model";
import styles from "./class-record-dialog.module.css";
export function ClassRecordDialog(props: LessonDialogProps): ReactElement {
  const model = useLessonDialog(props);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) model.requestClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <LessonDialogContent model={model} />
      </DialogPortal>
    </Dialog>
  );
}
function LessonDialogContent({ model }: { model: LessonDialogModel }): ReactElement {
  return (
    <DialogContent
      size="extra-wide"
      className="md:w-[calc(100%_-_2rem)]"
      showCloseButton={!model.editorState.pending}
    >
      <LessonDialogHeading model={model} />
      <LessonDialogBody model={model} />
      <LessonDialogFooter model={model} />
      {model.discard && (
        <DiscardRegistrationDialog
          onKeep={() => model.setDiscard(false)}
          onDiscard={model.props.onClose}
        />
      )}
    </DialogContent>
  );
}
function LessonDialogHeading({ model }: { model: LessonDialogModel }): ReactElement {
  if (model.query.data) return <LessonHeader data={model.query.data} />;
  if (model.query.isPending) return <LessonLoadingHeader />;
  return (
    <DialogHeader>
      <DialogTitle className="text-base">Detalhes da aula</DialogTitle>
    </DialogHeader>
  );
}
function LessonDialogBody({ model }: { model: LessonDialogModel }): ReactElement {
  return (
    <DialogBody aria-busy={model.query.isPending}>
      {model.query.isPending ? (
        <LessonLoadingList />
      ) : (
        <RecordState
          pending={false}
          error={model.query.error}
          retry={() => void model.query.refetch()}
        />
      )}
      {model.query.data && <LessonDialogRecord model={model} data={model.query.data} />}
    </DialogBody>
  );
}
function LessonDialogRecord({
  model,
  data,
}: {
  model: LessonDialogModel;
  data: ClassRecord;
}): ReactElement {
  return (
    <div className="grid min-w-0 gap-5">
      {model.teacher && !model.editing && <StudentAttendanceSection sessionId={model.props.id} />}
      {model.editing ? (
        <ClassRecordEditor
          key={model.props.id}
          data={data}
          declarations={model.attendance.data?.declarations ?? []}
          externalSubmit
          onStateChange={model.setEditorState}
          onClose={model.finish}
        />
      ) : (
        <LessonDetails key={model.props.id} data={data} />
      )}
      {model.teacher && data.restriction && <Alert>{data.restriction}</Alert>}
    </div>
  );
}
function LessonDialogFooter({ model }: { model: LessonDialogModel }): ReactElement {
  return (
    <DialogFooter>
      <Button variant="secondary" onClick={model.requestClose} disabled={model.editorState.pending}>
        <X aria-hidden="true" />
        Fechar
      </Button>
      {model.query.data && !model.editing && (
        <LessonClassLink model={model} data={model.query.data} />
      )}
      <LessonEditorActions model={model} />
    </DialogFooter>
  );
}
function LessonClassLink({
  model,
  data,
}: {
  model: LessonDialogModel;
  data: ClassRecord;
}): ReactElement {
  return (
    <Button
      variant="link"
      nativeButton={false}
      render={<Link href={`${model.teacher ? "/professor" : ""}/turmas/${data.session.classId}`} />}
    >
      Ver turma
      <ArrowUpRight aria-hidden="true" />
    </Button>
  );
}
function LessonEditorActions({ model }: { model: LessonDialogModel }): ReactElement {
  const data = model.query.data;
  return (
    <>
      {model.teacher && data && !data.restriction && !model.editing && (
        <Button onClick={() => model.setEditing(true)}>
          <Pencil aria-hidden="true" />
          {data.version ? "Corrigir registro" : "Registrar aula"}
        </Button>
      )}
      {model.editing && (
        <Button type="submit" form="class-record-editor" disabled={model.editorState.pending}>
          <ClipboardCheck aria-hidden="true" />
          {data?.version ? "Conferir correção" : "Conferir e dar baixa"}
        </Button>
      )}
    </>
  );
}
function LessonHeader({ data }: { data: ClassRecord }): ReactElement {
  const { session } = data;
  const recorded = data.version > 0 || data.attendanceOnly;
  return (
    <DialogHeader>
      <div className={styles.headingRow}>
        <div className={styles.title}>
          <DialogTitle className="text-base">{session.className}</DialogTitle>
          <Badge variant={recorded && !session.cancelled ? "success" : "neutral"}>
            {lessonStatus(data)}
          </Badge>
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
function lessonStatus(data: ClassRecord): string {
  if (data.session.cancelled) return "Cancelada";
  if (data.version > 0 || data.attendanceOnly) return "Presença registrada";
  return data.session.upcoming ? "Agendada" : "Presença não registrada";
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
function CoveredPages({ data }: { data: ClassRecord }): ReactElement {
  const content = data.snapshot.sharedContent;
  if (!content) return <>Conteúdo ainda não registrado</>;
  const pages =
    content.pageFrom === null
      ? null
      : `Pág. ${content.pageFrom}${lastPage(content.pageFrom, content.pageTo)}`;
  return <span title={content.reference ?? undefined}>{pages ?? "Páginas não informadas"}</span>;
}
function lastPage(from: number, to: number | null): string {
  return to !== null && to !== from ? `–${to}` : "";
}
