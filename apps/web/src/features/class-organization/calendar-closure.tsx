"use client";
import type { ReactElement } from "react";
import { CalendarChangeForm } from "~/features/academic-calendar/change-form";
import type { OrganizationDialogProps } from "./dialogs";
export function ClosureForm({ onClose }: OrganizationDialogProps): ReactElement {
  return <CalendarChangeForm mode="interruption" onClose={onClose} />;
}
