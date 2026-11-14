"use client";
import type { ReactElement } from "react";
import { CalendarChangeForm } from "~/features/academic-calendar/change-form";
import type { OrganizationDialogProps } from "./dialogs";
export function PeriodForm({ board, onClose }: OrganizationDialogProps): ReactElement {
  return <CalendarChangeForm mode="period" item={board.semester} onClose={onClose} />;
}
