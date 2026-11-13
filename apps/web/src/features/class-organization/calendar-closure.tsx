"use client";
import { CalendarChangeForm } from "~/features/academic-calendar/change-form";
import type { OrganizationDialogProps } from "./dialogs";
export function ClosureForm({ onClose }: OrganizationDialogProps) {
  return <CalendarChangeForm mode="interruption" onClose={onClose} />;
}
