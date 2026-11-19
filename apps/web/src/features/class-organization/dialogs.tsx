"use client";
import { type JSX as ReactJSX } from "react";
import { ResetFormationDialog } from "./reset-formation-dialog";
import { RiskLimitDialog, PostponeDialog } from "./formation-settings";
import { ClassCreateDialog } from "~/features/classes/create-dialog";
import { ClassPlanForm } from "~/features/class-organization/plan-form";
import { PlacementForm } from "~/features/class-organization/placement-form";
import { PlacementDateDialog } from "./placement-date-dialog";
import { ReasonDialog, PlacementHistory } from "~/features/class-organization/action-dialogs";
import type { OrganizationAction, OrganizationBoard } from "./model";
import { ContinuityDialog, PlanStatusDialog } from "./continuity";
import { FindStudent } from "./find-student-dialog";
import { MovementForm } from "./movement-dialog";

export type OrganizationDialogProps = {
  action: OrganizationAction;
  board: OrganizationBoard;
  onAction: (action: OrganizationAction) => void;
  onClose: () => void;
  onPlan: (id: string) => void;
  onFeedback: (message: string) => void;
};
type Props = OrganizationDialogProps;

export function OrganizationDialogs(props: Props): ReactJSX.Element {
  return (
    renderStudentDialogs(props) ??
    renderPlanDialogs(props) ??
    renderPlacementDialogs(props) ?? <></>
  );
}

function renderStudentDialogs(props: Props): ReactJSX.Element | null {
  const { action, board, onClose, onAction } = props;
  switch (action.kind) {
    case "continuity": {
      return (
        <ContinuityDialog
          row={action.row}
          board={board}
          onClose={onClose}
          onFeedback={props.onFeedback}
        />
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
    case "resetFormation": {
      return <ResetFormationDialog board={board} onClose={onClose} onFeedback={props.onFeedback} />;
    }
    case "riskLimit": {
      return <RiskLimitDialog {...props} />;
    }
    case "postpone": {
      return <PostponeDialog {...props} plan={action.plan} />;
    }
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
      if (!action.plan && !action.group)
        return (
          <ClassCreateDialog
            open
            initialSemesterId={board.semester.id}
            onOpenChange={(open) => {
              if (!open) onClose();
            }}
          />
        );
      return (
        <ClassPlanForm
          semesterId={board.semester.id}
          {...(action.plan ? { plan: action.plan } : {})}
          {...(action.group ? { group: action.group } : {})}
          onClose={onClose}
          onSaved={(id) => {
            props.onPlan(id);
            onClose();
          }}
        />
      );
    }
    default: {
      return null;
    }
  }
}

function renderPlacementDialogs(props: Props): ReactJSX.Element | null {
  const { action, board, onClose } = props;
  switch (action.kind) {
    case "placementDate": {
      return (
        <PlacementDateDialog
          row={action.row}
          board={board}
          onClose={onClose}
          onFeedback={props.onFeedback}
        />
      );
    }
    case "placement": {
      return (
        <PlacementForm
          studentId={action.studentId}
          board={board}
          {...(action.row ? { row: action.row } : {})}
          {...(action.planId ? { initialPlanId: action.planId } : {})}
          onClose={onClose}
          onFeedback={props.onFeedback}
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
