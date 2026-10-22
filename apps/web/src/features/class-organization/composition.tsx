"use client";
import type { JSX as ReactJSX } from "react";
import type { ClassPlan, OrganizationAction, SemesterBoard } from "./model";
import { useCompositionModel } from "./composition-model";
import {
  CompositionHeader,
  LeavingNote,
  CompositionList,
  CompositionFooter,
} from "./composition-sections";
import styles from "./organization.module.css";

export function Composition({
  plan,
  board,
  onBack,
  onAction,
  onFeedback,
}: {
  plan: ClassPlan;
  board: SemesterBoard;
  onBack: () => void;
  onAction: (action: OrganizationAction) => void;
  onFeedback: (message: string) => void;
}): ReactJSX.Element {
  const model = useCompositionModel({ plan, board, onFeedback });
  return (
    <aside className={styles.panel} aria-label={`Alunos de ${plan.name}`}>
      <CompositionHeader plan={plan} ended={model.ended} onBack={onBack} onAction={onAction} />
      <LeavingNote leaving={model.leaving} total={model.rows.length} />
      <CompositionList
        rows={model.rows}
        leads={model.leads}
        board={board}
        ended={model.ended}
        onBack={onBack}
        onAction={onAction}
      />
      {model.error && (
        <p role="alert" className={styles.error}>
          {model.error}
        </p>
      )}
      <CompositionFooter
        plan={plan}
        ready={model.ready}
        ended={model.ended}
        pending={model.pending}
        onPublish={model.onPublish}
        onAction={onAction}
      />
    </aside>
  );
}
