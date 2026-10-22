import type { JSX as ReactJSX } from "react";
import { ClassPlanForm } from "./plan-form";
import { PlacementForm } from "./placement-form";
import { AvailabilityForm } from "./availability-form";
import { ReasonDialog, PlacementHistory } from "./action-dialogs";
import type { SemesterBoard } from "./shared";
import type { SemesterPageModel } from "./page-model";

export function BoardDialogs({
  board,
  model,
}: {
  board: SemesterBoard;
  model: SemesterPageModel;
}): ReactJSX.Element {
  return (
    <>
      <PlanDialog board={board} model={model} />
      <PlacementEditorDialogs board={board} model={model} />
      <PlacementHistoryDialogs board={board} model={model} />
    </>
  );
}

function PlanDialog({
  board,
  model,
}: {
  board: SemesterBoard;
  model: SemesterPageModel;
}): ReactJSX.Element | null {
  if (!model.planForm) return null;
  return (
    <ClassPlanForm
      semesterId={board.semester.id}
      {...(model.planForm === "new" ? {} : { plan: model.planForm })}
      onClose={() => model.setPlanForm(null)}
      onSaved={model.selectPlan}
    />
  );
}

function PlacementEditorDialogs({
  board,
  model,
}: {
  board: SemesterBoard;
  model: SemesterPageModel;
}): ReactJSX.Element {
  const action = model.action;
  return (
    <>
      {(action?.kind === "edit" || action?.kind === "newPlacement") && (
        <PlacementForm
          studentId={action.kind === "newPlacement" ? action.studentId : action.row.studentId}
          {...(action.kind === "edit" ? { row: action.row } : {})}
          board={board}
          onClose={() => model.setAction(null)}
        />
      )}
      {action?.kind === "availability" && (
        <AvailabilityForm
          studentId={action.row.studentId}
          board={board}
          onClose={() => model.setAction(null)}
          onInvalidate={(previousId) =>
            model.setAction({ kind: "invalidate", row: action.row, previousId })
          }
        />
      )}
    </>
  );
}

function PlacementHistoryDialogs({
  board,
  model,
}: {
  board: SemesterBoard;
  model: SemesterPageModel;
}): ReactJSX.Element {
  const action = model.action;
  return (
    <>
      {(action?.kind === "withdraw" || action?.kind === "invalidate") && (
        <ReasonDialog
          action={action.kind}
          row={action.row}
          {...(action.kind === "invalidate" ? { previousId: action.previousId } : {})}
          board={board}
          onClose={() => model.setAction(null)}
        />
      )}
      {action?.kind === "history" && (
        <PlacementHistory row={action.row} onClose={() => model.setAction(null)} />
      )}
    </>
  );
}
