"use client";
import type { JSX as ReactJSX } from "react";
import { dateOnly } from "~/features/semester-organization/shared";
import type { OrganizationAction, SemesterBoard } from "./model";
import { CalendarMonths } from "./calendar-months";
import { CalendarSidebar } from "./calendar-sidebar";
import styles from "./organization.module.css";

export function OrganizationCalendar({
  board,
  onAction,
}: {
  board: SemesterBoard;
  onAction: (action: OrganizationAction) => void;
}): ReactJSX.Element {
  const start = dateOnly(board.semester.startDate);
  const end = dateOnly(board.semester.endDate);
  return (
    <div className={styles.workspace}>
      <CalendarMonths board={board} start={start} end={end} onAction={onAction} />
      <CalendarSidebar board={board} start={start} end={end} onAction={onAction} />
    </div>
  );
}
