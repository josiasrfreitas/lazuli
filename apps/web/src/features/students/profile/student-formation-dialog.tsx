"use client";

import { useState, type ReactElement } from "react";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  Button,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { StudentAcademicProgress } from "~/features/assessments/student-progress";
import { OrganizationDialogs } from "~/features/class-organization/dialogs";
import { dateOnly } from "~/features/class-organization/shared";
import { toDateOnlySaoPaulo } from "~/lib/format";
import type { OrganizationAction, Placement } from "~/features/class-organization/model";
import { AttendanceHistoryContent } from "./attendance-history-dialog";

function placementAction(
  row: Placement,
  { task, viewOnly }: { task: string | undefined; viewOnly: boolean },
): OrganizationAction | null {
  if (task === "historico") return { kind: "history", row };
  if ((viewOnly || row.declinedAt) && (task === "turma" || task === "decisao"))
    return { kind: "history", row };
  if (task === "turma")
    return row.publishedAt
      ? { kind: "move", rows: [row] }
      : { kind: "placement", studentId: row.studentId, row };
  if (task === "decisao") return { kind: "continuity", row };
  return null;
}

/** Reopen the same placement task on the student's page, resolving it against the current board. */
export function StudentFormationDialog({
  studentId,
  request,
  close,
}: {
  studentId: string;
  request: string;
  close: () => void;
}): ReactElement {
  const [semesterId, placementId, task] = request.split(":");
  const query = trpc.semesterOrganization.detail.useQuery(
    { semesterId: semesterId ?? "" },
    { enabled: Boolean(semesterId && placementId), retry: false },
  );
  const [nextAction, setNextAction] = useState<OrganizationAction | null>(null);
  const board = query.data;
  const row = board?.placements.find(
    (item) => item.id === placementId && item.studentId === studentId,
  );
  const viewOnly = board
    ? dateOnly(board.semester.endDate) < toDateOnlySaoPaulo(new Date())
    : false;
  const selected = row && (nextAction ?? placementAction(row, { task, viewOnly }));
  if (board && selected)
    return (
      <OrganizationDialogs
        action={selected}
        board={board}
        onAction={setNextAction}
        onClose={close}
        onPlan={close}
        onFeedback={() => {}}
      />
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className={task === "notas" ? "md:max-w-5xl" : "md:max-w-3xl"}>
          <StudentFormationContent
            row={row}
            studentId={studentId}
            task={task}
            fetching={query.isFetching}
            failed={query.isError}
            retry={() => void query.refetch()}
          />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function StudentFormationContent({
  row,
  studentId,
  task,
  fetching,
  failed,
  retry,
}: {
  row: Placement | undefined;
  studentId: string;
  task: string | undefined;
  fetching: boolean;
  failed: boolean;
  retry: () => void;
}): ReactElement {
  if (row && task === "notas")
    return (
      <StudentAcademicProgress
        studentName={row.studentName}
        studentId={studentId}
        initialProgressId={row.sourceProgressId ?? undefined}
      />
    );
  if (row && task === "presenca")
    return (
      <>
        <DialogHeader>
          <DialogTitle>Histórico de frequência</DialogTitle>
          <DialogDescription>{row.studentName}</DialogDescription>
        </DialogHeader>
        <AttendanceHistoryContent
          studentId={studentId}
          studentName={row.studentName}
          enrollmentId={row.sourceEnrollmentId ?? undefined}
        />
      </>
    );
  return (
    <>
      <DialogHeader>
        <DialogTitle>Vínculo do aluno</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <UnavailablePlacement fetching={fetching} failed={failed} retry={retry} />
      </DialogBody>
    </>
  );
}

function UnavailablePlacement({
  fetching,
  failed,
  retry,
}: {
  fetching: boolean;
  failed: boolean;
  retry: () => void;
}): ReactElement {
  if (fetching) return <p role="status">Carregando vínculo…</p>;
  if (failed)
    return (
      <>
        <p role="alert">Não foi possível carregar este vínculo.</p>
        <Button size="sm" onClick={retry}>
          Tentar novamente
        </Button>
      </>
    );
  return <p>Este vínculo não está disponível neste semestre.</p>;
}
