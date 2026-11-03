"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { Button } from "@lazuli/ui";
import { type OrganizationAction, type OrganizationBoard } from "./model";
import { ClassPlanList } from "./class-plan-list";
import { Composition } from "./composition";
import { queueData } from "./queue-model";
import { PendingRail } from "./pending-rail";
import styles from "./organization.module.css";

type Props = {
  board: OrganizationBoard;
  search: string;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onAction: (action: OrganizationAction) => void;
  onFeedback: (message: string) => void;
  showClosed: boolean;
};
export function OrganizationAgenda({
  board,
  search,
  selected,
  onSelect,
  onAction,
  onFeedback,
  showClosed,
}: Props): ReactJSX.Element {
  const [mobilePanel, setMobilePanel] = useState(false);
  const pending = queueData(board).count;
  function selectPlan(id: string | null): void {
    onSelect(id);
    setMobilePanel(false);
  }
  return (
    <div className={`${styles.workspace} ${styles.agendaWorkspace}`} data-panel={mobilePanel}>
      <MobileContext active={mobilePanel} pending={pending} onChange={setMobilePanel} />
      <div className={styles.agenda}>
        <div className={styles.calendar}>
          <ClassPlanList
            board={board}
            query={search}
            selected={selected}
            onSelect={(id) => selectPlan(selected === id ? null : id)}
            showClosed={showClosed}
            renderExpansion={(selectedPlan) => (
              <Composition
                key={selectedPlan.id}
                plan={selectedPlan}
                board={board}
                onAction={onAction}
                onFeedback={onFeedback}
              />
            )}
          />
        </div>
      </div>
      <PendingRail
        board={board}
        onAction={onAction}
        onSelect={selectPlan}
        mobileOpen={mobilePanel}
      />
    </div>
  );
}

function MobileContext({
  active,
  pending,
  onChange,
}: {
  active: boolean;
  pending: number;
  onChange: (active: boolean) => void;
}): ReactJSX.Element {
  return (
    <div className={styles.mobileContext}>
      <Button
        size="sm"
        variant={active ? "ghost" : "secondary"}
        aria-pressed={!active}
        onClick={() => onChange(false)}
      >
        Turmas
      </Button>
      <Button
        size="sm"
        variant={active ? "secondary" : "ghost"}
        aria-pressed={active}
        onClick={() => onChange(true)}
      >
        {`Pendências · ${pending}`}
      </Button>
    </div>
  );
}
