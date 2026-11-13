"use client";
import { CalendarChangeForm } from "~/features/academic-calendar/change-form";
import type { OrganizationDialogProps } from "./dialogs";
export function PeriodForm({ board, onClose }: OrganizationDialogProps) {
  return <CalendarChangeForm mode="period" item={board.semester} onClose={onClose} />;
}
