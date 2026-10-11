import Link from "next/link";
import type { RouterOutputs } from "@lazuli/api";
import { cn } from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import { purposes, statuses } from "./shared";
export type TeacherAppointment = RouterOutputs["teachers"]["week"]["appointments"][number];
export function TeacherAppointmentBlock({
  row,
  compact = false,
}: {
  row: TeacherAppointment;
  compact?: boolean;
}) {
  const description = `${purposes[row.purpose]}, ${row.studentName}, ${formatDateOnlyBR(row.date)}, ${row.startTime}–${row.endTime}, ${statuses[row.status]}`;
  return (
    <Link
      href={`/atendimentos/${row.id}`}
      aria-label={description}
      title={description}
      className={cn(
        "flex min-w-0 flex-col border-l-2 border-info bg-info/10 text-left text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        compact
          ? "min-h-0 flex-1 justify-center overflow-hidden px-2 py-0.5"
          : "gap-1 rounded-sm px-3 py-2",
        row.status === "CANCELLED" && "opacity-60 line-through",
      )}
    >
      <span
        className={cn("truncate font-semibold", compact ? "text-xs leading-3.5" : "text-caption")}
      >
        {purposes[row.purpose]} · {row.studentName}
      </span>
      <span
        className={
          compact ? "text-micro leading-3 opacity-80" : "text-caption text-muted-foreground"
        }
      >
        {row.startTime}–{row.endTime}
        {compact ? "" : ` · ${statuses[row.status]}`}
      </span>
    </Link>
  );
}
