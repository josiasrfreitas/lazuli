"use client";
import type { ReactElement } from "react";
import { CalendarChangeForm } from "~/features/academic-calendar/change-form";
export function SemesterForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (id: string) => void;
}): ReactElement {
  return <CalendarChangeForm mode="period" onClose={onClose} onSaved={onSaved} />;
}
