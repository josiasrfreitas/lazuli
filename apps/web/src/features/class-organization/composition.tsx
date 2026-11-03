"use client";
import type { JSX as ReactJSX } from "react";
import type { ClassPlan, OrganizationAction, OrganizationBoard } from "./model";
import { useCompositionModel } from "./composition-model";
import { CompositionMenu, LeavingNote, CompositionFooter } from "./composition-sections";
import { ClassRoster } from "./class-roster";
import styles from "./organization.module.css";

export function Composition({
  plan,
  board,
  onAction,
  onFeedback,
}: {
  plan: ClassPlan;
  board: OrganizationBoard;
  onAction: (action: OrganizationAction) => void;
  onFeedback: (message: string) => void;
}): ReactJSX.Element {
  const model = useCompositionModel({ plan, board, onFeedback });
  return (
    <section className={styles.classExpansion} aria-label={`Alunos de ${plan.name}`}>
      <LeavingNote leaving={model.leaving} total={model.rows.length} />
      <ClassRoster
        rows={model.rows}
        leads={model.leads}
        board={board}
        ended={model.ended}
        onAction={onAction}
        tools={<CompositionMenu plan={plan} ended={model.ended} onAction={onAction} />}
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
    </section>
  );
}
