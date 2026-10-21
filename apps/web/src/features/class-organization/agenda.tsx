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
  const pendingRows = board.placements.filter(isQueueItem);
  const waitingLeads = board.waitingLeads.filter(
    (lead) => !pendingRows.some((row) => row.studentId === lead.studentId),
  );
  const pending =
    pendingRows.length +
    waitingLeads.length +
    board.intents.filter(
      (intent) => !waitingLeads.some((lead) => lead.studentId === intent.studentId),
    ).length;
  function selectPlan(id: string | null): void {
    onSelect(id);
    setMobilePanel(true);
  }
  return (
    <div className={`${styles.workspace} ${styles.agendaWorkspace}`} data-panel={mobilePanel}>
      <div className={styles.mobileContext}>
        <Button
          size="sm"
          variant={mobilePanel ? "ghost" : "secondary"}
          aria-pressed={!mobilePanel}
          onClick={() => setMobilePanel(false)}
        >
          Turmas
        </Button>
        <Button
          size="sm"
          variant={mobilePanel ? "secondary" : "ghost"}
          aria-pressed={mobilePanel}
          onClick={() => setMobilePanel(true)}
        >
          {plan ? "Alunos da turma" : `Pendências · ${pending}`}
        </Button>
      </div>
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
