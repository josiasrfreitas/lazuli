"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { Button } from "@lazuli/ui";
import { isQueueItem, type OrganizationAction, type SemesterBoard } from "./model";
import { WeeklySchedule } from "./weekly-schedule";
import { Composition } from "./composition";
import { AccommodationQueue } from "./queue";
import styles from "./organization.module.css";

type Props = {
  board: SemesterBoard;
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
  const plan = board.plans.find((item) => item.id === selected);
  const pending = pendingCount(board);
  function selectPlan(id: string | null): void {
    onSelect(id);
    setMobilePanel(true);
  }
  return (
    <div className={`${styles.workspace} ${styles.agendaWorkspace}`} data-panel={mobilePanel}>
      <MobileContext
        active={mobilePanel}
        hasPlan={Boolean(plan)}
        pending={pending}
        onChange={setMobilePanel}
      />
      <div className={styles.agenda}>
        <div className={styles.calendar}>
          <WeeklySchedule
            board={board}
            query={search}
            selected={selected}
            onSelect={selectPlan}
            showClosed={showClosed}
          />
        </div>
      </div>
      {plan ? (
        <Composition
          key={plan.id}
          plan={plan}
          board={board}
          onBack={() => selectPlan(null)}
          onAction={onAction}
          onFeedback={onFeedback}
        />
      ) : (
        <AccommodationQueue board={board} onAction={onAction} onSelect={selectPlan} />
      )}
    </div>
  );
}

function pendingCount(board: SemesterBoard): number {
  const pendingRows = board.placements.filter((row) => isQueueItem(row));
  const waitingLeads = board.waitingLeads.filter(
    (lead) => !pendingRows.some((row) => row.studentId === lead.studentId),
  );
  return (
    pendingRows.length +
    waitingLeads.length +
    board.intents.filter(
      (intent) => !waitingLeads.some((lead) => lead.studentId === intent.studentId),
    ).length
  );
}

function MobileContext({
  active,
  hasPlan,
  pending,
  onChange,
}: {
  active: boolean;
  hasPlan: boolean;
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
        {hasPlan ? "Alunos da turma" : `Pendências · ${pending}`}
      </Button>
    </div>
  );
}
