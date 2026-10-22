"use client";
import { useState, type JSX as ReactJSX } from "react";
import { ClassPlanForm, SemesterForm } from "~/features/semester-organization/plan-form";
import { PlacementForm } from "~/features/semester-organization/placement-form";
import { AvailabilityForm } from "~/features/semester-organization/availability-form";
import { ReasonDialog, PlacementHistory } from "~/features/semester-organization/action-dialogs";
import { dateOnly, useOrganizationRefresh } from "~/features/semester-organization/shared";
import { NewStudentDialog } from "~/features/students/new-student/new-student-dialog";
import type { OrganizationAction, Placement, SemesterBoard } from "./model";
import { ClosureForm, PeriodForm, HolidayForm } from "./calendar-forms";
import { RenewalDialog } from "./renewal";
import { ContinuityDialog, PlanStatusDialog } from "./continuity";
import { FindStudent } from "./find-student-dialog";
import { MovementForm } from "./movement-dialog";

export type OrganizationDialogProps = {
  action: OrganizationAction;
  board: SemesterBoard;
  onAction: (action: OrganizationAction) => void;
  onClose: () => void;
  onSemester: (id: string) => void;
  onPlan: (id: string) => void;
  onFeedback: (message: string) => void;
};
type Props = OrganizationDialogProps;

export function OrganizationDialogs(props: Props): ReactJSX.Element {
  const [invalidate, setInvalidate] = useState<string | null>(null);
  const refresh = useOrganizationRefresh();
  return (
    renderStudentDialogs(props, refresh) ??
    renderPlanDialogs(props) ??
    renderPlacementDialogs(props, { invalidate, setInvalidate }) ??
    renderCalendarDialogs(props) ?? <></>
  );
}

function renderStudentDialogs(props: Props, refresh: () => Promise<void>): ReactJSX.Element | null {
  const { action, board, onClose, onAction } = props;
  switch (action.kind) {
    case "continuity": {
      return (
        <ContinuityDialog row={action.row} board={board} onClose={onClose} onAction={onAction} />
      );
    }
    case "renew": {
      return (
        <RenewalDialog
          contractId={action.contractId}
          onClose={onClose}
          onSaved={() =>
            props.onFeedback(
              "Contrato renovado com os termos revisados. A alocação pedagógica permanece independente.",
            )
          }
        />
      );
    }
    case "findStudent": {
      return <FindStudent board={board} onClose={onClose} onAction={onAction} />;
    }
    case "student": {
      return (
        <NewStudentDialog
          open
          initialSemesterId={board.semester.id}
          onOpenChange={(open) => {
            if (!open) onClose();
          }}
          onCreated={() => {
            void refresh();
            onClose();
            props.onFeedback("Aluno cadastrado. A intenção pedagógica já aparece na organização.");
          }}
        />
      );
    }
    default: {
      return null;
    }
  }
}

function renderPlanDialogs(props: Props): ReactJSX.Element | null {
  const { action, board, onClose } = props;
  switch (action.kind) {
    case "planStatus": {
      return (
        <PlanStatusDialog
          plan={action.plan}
          open={action.open}
          onClose={onClose}
          onFeedback={props.onFeedback}
        />
      );
    }
    case "plan": {
      return (
        <ClassPlanForm
          semesterId={board.semester.id}
          {...(action.plan ? { plan: action.plan } : {})}
          {...(action.group ? { group: action.group } : {})}
          onClose={onClose}
          onSaved={props.onPlan}
        />
      );
    }
    case "newSemester": {
      return <SemesterForm onClose={onClose} onSaved={props.onSemester} />;
    }
    default: {
      return null;
    }
  }
}

function renderPlacementDialogs(
  props: Props,
  state: { invalidate: string | null; setInvalidate: (id: string) => void },
): ReactJSX.Element | null {
  const { action, board, onClose } = props;
  switch (action.kind) {
    case "placement": {
      return (
        <PlacementForm
          studentId={action.studentId}
          board={board}
          {...(action.row ? { row: action.row } : {})}
          {...(action.planId ? { initialPlanId: action.planId } : {})}
          onClose={onClose}
        />
      );
    }
    case "withdraw": {
      return <ReasonDialog action="withdraw" row={action.row} board={board} onClose={onClose} />;
    }
    case "history": {
      return <PlacementHistory row={action.row} onClose={onClose} />;
    }
    case "availability": {
      return (
        <AvailabilityDialog
          studentId={action.studentId}
          board={board}
          onClose={onClose}
          state={state}
        />
      );
    }
    case "move":
    case "decline": {
      return <MovementForm {...props} rows={action.rows} decline={action.kind === "decline"} />;
    }
    default: {
      return null;
    }
  }
}

function AvailabilityDialog({
  studentId,
  board,
  onClose,
  state,
}: {
  studentId: string;
  board: SemesterBoard;
  onClose: () => void;
  state: { invalidate: string | null; setInvalidate: (id: string) => void };
}): ReactJSX.Element {
  const row = availabilitySubject(board, studentId);
  return state.invalidate && row ? (
    <ReasonDialog
      action="invalidate"
      row={row}
      previousId={state.invalidate}
      board={board}
      onClose={onClose}
    />
  ) : (
    <AvailabilityForm
      studentId={studentId}
      board={board}
      onClose={onClose}
      onInvalidate={state.setInvalidate}
    />
  );
}

function renderCalendarDialogs(props: Props): ReactJSX.Element | null {
  const { action, board } = props;
  switch (action.kind) {
    case "closure": {
      return (
        <ClosureForm {...props} initialDate={action.date ?? dateOnly(board.semester.startDate)} />
      );
    }
    case "period": {
      return <PeriodForm {...props} />;
    }
    case "holidays": {
      return <HolidayForm {...props} />;
    }
    default: {
      return null;
    }
  }
}

function availabilitySubject(
  board: SemesterBoard,
  studentId: string,
): Pick<Placement, "id" | "version" | "studentId" | "studentName"> | undefined {
  const intent = board.intents.find((item) => item.studentId === studentId);
  return (
    board.placements.find((item) => item.studentId === studentId) ??
    (intent
      ? { id: intent.id, version: 0, studentId: intent.studentId, studentName: intent.studentName }
      : undefined)
  );
}
