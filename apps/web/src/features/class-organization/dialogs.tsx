"use client";
import { type JSX as ReactJSX } from "react";
import { ClassPlanForm, SemesterForm } from "~/features/class-organization/plan-form";
import { PlacementForm } from "~/features/class-organization/placement-form";
import { ReasonDialog, PlacementHistory } from "~/features/class-organization/action-dialogs";
import type { OrganizationAction, OrganizationBoard } from "./model";
import { ClosureForm, PeriodForm, HolidayForm } from "./calendar-forms";
import { ContinuityDialog, PlanStatusDialog } from "./continuity";
import { FindStudent } from "./find-student-dialog";
import { MovementForm } from "./movement-dialog";

export type OrganizationDialogProps = {
  action: OrganizationAction;
  board: OrganizationBoard;
  onAction: (action: OrganizationAction) => void;
  onClose: () => void;
  onSemester: (id: string) => void;
  onPlan: (id: string) => void;
  onFeedback: (message: string) => void;
};
type Props = OrganizationDialogProps;

export function OrganizationDialogs(props: Props): ReactJSX.Element {
  return (
    renderStudentDialogs(props) ??
    renderPlanDialogs(props) ??
    renderPlacementDialogs(props) ??
    renderCalendarDialogs(props) ?? <></>
  );
}

function renderStudentDialogs(props: Props): ReactJSX.Element | null {
  const { action, board, onClose, onAction } = props;
  switch (action.kind) {
    case "continuity": {
      return (
        <ContinuityDialog row={action.row} board={board} onClose={onClose} onAction={onAction} />
      );
    }
    case "findStudent": {
      return <FindStudent board={board} onClose={onClose} onAction={onAction} />;
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

function renderPlacementDialogs(props: Props): ReactJSX.Element | null {
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
    case "move":
    case "decline": {
      return <MovementForm {...props} rows={action.rows} decline={action.kind === "decline"} />;
    }
    default: {
      return null;
    }
  }
}

function renderCalendarDialogs(props: Props): ReactJSX.Element | null {
  const { action } = props;
  switch (action.kind) {
    case "closure": {
      return <ClosureForm {...props} />;
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
