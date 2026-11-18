"use client";

import { useState } from "react";
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
import type { OrganizationAction } from "~/features/class-organization/model";
import { AttendanceHistoryContent } from "./attendance-history-dialog";

/** Reopen the same placement task on the student's page, resolving it against the current board. */
export function StudentFormationDialog({
  studentId,
  request,
  close,
}: {
  studentId: string;
  request: string;
  close: () => void;
}) {
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
  const viewOnly = board && dateOnly(board.semester.endDate) < toDateOnlySaoPaulo(new Date());
  let action: OrganizationAction | null = null;
  if (row && board) {
    if (
      task === "historico" ||
      ((viewOnly || row.declinedAt) && (task === "turma" || task === "decisao"))
    )
      action = { kind: "history", row };
    else if (task === "turma")
      action = row.publishedAt
        ? { kind: "move", rows: [row] }
        : { kind: "placement", studentId, row };
    else if (task === "decisao") action = { kind: "continuity", row };
  }
  const selected = nextAction ?? action;
  if (board && row && selected)
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
          {row && task === "notas" ? (
            <StudentAcademicProgress
              studentName={row.studentName}
              studentId={studentId}
              initialProgressId={row.sourceProgressId ?? undefined}
            />
          ) : row && task === "presenca" ? (
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
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Vínculo do aluno</DialogTitle>
              </DialogHeader>
              <DialogBody>
                {query.isFetching ? (
                  <p role="status">Carregando vínculo…</p>
                ) : query.isError ? (
                  <>
                    <p role="alert">Não foi possível carregar este vínculo.</p>
                    <Button size="sm" onClick={() => void query.refetch()}>
                      Tentar novamente
                    </Button>
                  </>
                ) : (
                  <p>Este vínculo não está disponível neste semestre.</p>
                )}
              </DialogBody>
            </>
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
