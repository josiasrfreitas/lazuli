import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import Link from "next/link";
import { cn } from "@lazuli/ui";
import { dateLabel } from "./format";

export type Introduction = RouterOutputs["teachers"]["week"]["introductions"][number];

export function IntroductionBlock({
  row,
  compact = false,
}: {
  row: Introduction;
  compact?: boolean;
}): ReactElement {
  const status = {
    SCHEDULED: "Agendada",
    ATTENDED: "Compareceu",
    ABSENT: "Não compareceu",
    CANCELLED: "Cancelada",
  }[row.status];
  const interval = `${dateLabel(row.date)}, ${row.startTime}–${row.endTime}`;
  const description = `Aula introdutória, ${row.candidateName}, ${interval}, ${status}`;
  return (
    <Link
      href={`/interessados/${row.candidateId}`}
      aria-label={description}
      title={description}
      className={cn(
        "flex min-w-0 flex-col border-l-2 border-selection-indicator bg-accent text-left font-numeric text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        compact
          ? "min-h-0 flex-1 justify-center overflow-hidden px-2 py-0.5"
          : "gap-1 rounded-sm px-3 py-2",
        row.status === "CANCELLED" && "opacity-60 line-through",
      )}
    >
      <span
        className={cn("truncate font-semibold", compact ? "text-xs leading-3.5" : "text-caption")}
      >
        Introdutória · {row.candidateName}
      </span>
      <span className={compact ? "text-micro leading-3 opacity-80" : "text-caption opacity-80"}>
        {compact
          ? `${row.startTime}–${row.endTime}`
          : `${row.startTime}–${row.endTime} · ${row.format === "ONLINE" ? "Online" : "Presencial"} · ${status}`}
      </span>
    </Link>
  );
}
