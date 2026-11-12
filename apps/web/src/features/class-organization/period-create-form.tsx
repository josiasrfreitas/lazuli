"use client";
import { CalendarChangeForm } from "~/features/academic-calendar/change-form";
export function SemesterForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  return <CalendarChangeForm mode="period" onClose={onClose} onSaved={onSaved} />;
}
