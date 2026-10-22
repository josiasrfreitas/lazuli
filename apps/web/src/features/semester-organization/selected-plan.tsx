import type { JSX as ReactJSX } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Alert, Button } from "@lazuli/ui";
import { scheduleLabel, type ClassPlan, type Placement, type SemesterBoard } from "./shared";
import { SemesterRoster, type PlacementAction } from "./roster";

export function SelectedPlan({
  board,
  plan,
  rows,
  readOnly,
  selectedId,
  onBack,
  onReview,
  onAction,
}: {
  board: SemesterBoard;
  plan: ClassPlan | undefined;
  rows: Placement[];
  readOnly: boolean;
  selectedId: string;
  onBack: () => void;
  onReview: (plan: ClassPlan) => void;
  onAction: (action: PlacementAction) => void;
}): ReactJSX.Element {
  return (
    <>
      <SelectedPlanHeader plan={plan} readOnly={readOnly} onBack={onBack} onReview={onReview} />
      {plan?.draftConflicts.length ? (
        <Alert variant="warning">
          Horário do professor também proposto em {plan.draftConflicts.join(", ")}. Revise a
          composição antes de publicar ambas as turmas.
        </Alert>
      ) : null}
      <SemesterRoster
        key={selectedId}
        board={board}
        plan={plan}
        rows={rows}
        readOnly={readOnly}
        onAction={onAction}
      />
    </>
  );
}

function SelectedPlanHeader({
  plan,
  readOnly,
  onBack,
  onReview,
}: {
  plan: ClassPlan | undefined;
  readOnly: boolean;
  onBack: () => void;
  onReview: (plan: ClassPlan) => void;
}): ReactJSX.Element {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="grid gap-2">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft />
            Todas as turmas
          </Button>
        </div>
        <h2 className="font-display text-h3 font-semibold text-heading">
          {plan?.name ?? "Ainda sem turma"}
        </h2>
        {plan && (
          <p className="text-caption text-muted-foreground">
            {plan.teacherName ?? "Professor a definir"} ·{" "}
            {plan.format === "ONLINE" ? "Online" : "Presencial"}
            <br />
            {scheduleLabel(plan.slots)}
          </p>
        )}
      </div>
      {plan && <SelectedPlanActions plan={plan} readOnly={readOnly} onReview={onReview} />}
    </div>
  );
}

function SelectedPlanActions({
  plan,
  readOnly,
  onReview,
}: {
  plan: ClassPlan;
  readOnly: boolean;
  onReview: (plan: ClassPlan) => void;
}): ReactJSX.Element | null {
  if (plan.classId) {
    return (
      <Button variant="secondary" size="sm" render={<Link href={`/turmas/${plan.classId}`} />}>
        Abrir turma
        <ArrowUpRight />
      </Button>
    );
  }
  if (readOnly) return null;
  return (
    <Button variant="secondary" size="sm" onClick={() => onReview(plan)}>
      Revisar turma
    </Button>
  );
}
