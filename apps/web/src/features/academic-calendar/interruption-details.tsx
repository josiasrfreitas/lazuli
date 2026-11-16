import type { ReactElement } from "react";
import type { AcademicYear } from "./model";

const DATE_LENGTH = 10;

/** The annual grid stays compact; descriptions appear when an operator inspects a date. */
export function CalendarInterruptionDetails({
  data,
  date,
}: {
  data: AcademicYear;
  date: string;
}): ReactElement | null {
  const interruptions = data.interruptions.filter(
    (item) =>
      item.description &&
      item.fromDate.toISOString().slice(0, DATE_LENGTH) <= date &&
      item.throughDate.toISOString().slice(0, DATE_LENGTH) >= date,
  );
  if (interruptions.length === 0) return null;
  return (
    <div className="grid gap-2 text-caption" aria-label="Informações sobre os recessos">
      {interruptions.map((item) => (
        <p key={item.id} className="whitespace-pre-line">
          <strong>{item.title}: </strong>
          {item.description}
        </p>
      ))}
    </div>
  );
}
