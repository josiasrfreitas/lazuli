import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import Link from "next/link";
import { cn } from "@lazuli/ui";

export type AgendaSlot = RouterOutputs["teachers"]["agenda"]["rows"][number];

export function MeetingBlock({
  meeting,
  compact = false,
  back,
}: {
  meeting: AgendaSlot;
  compact?: boolean;
  back: string;
}): ReactElement {
  const label =
    meeting.scheduleType === "PERSONALIZED" ? "PPT" : (meeting.stageName ?? meeting.classCode);
  const format = meeting.format === "ONLINE" ? "Online" : "Presencial";
  const interval = `${meeting.startTime}–${meeting.endTime}`;
  const description = `${meeting.className} · ${label} · ${format} · ${interval}`;
  return (
    <Link
      href={`/turmas/${meeting.classId}?voltar=${encodeURIComponent(back)}`}
      title={description}
      aria-label={`Abrir turma: ${description}`}
      className={cn(
        "flex w-full min-w-0 flex-col text-left font-numeric transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        compact
          ? "min-h-0 flex-1 justify-center overflow-hidden px-2 py-0.5"
          : "gap-1 rounded-sm px-3 py-2",
        meeting.scheduleType === "REGULAR"
          ? "bg-accent text-accent-foreground hover:bg-accent-hover"
          : "bg-secondary text-secondary-foreground hover:bg-border",
      )}
    >
      <span
        className={cn(
          "w-full min-w-0 truncate font-semibold",
          compact ? "text-xs leading-3.5" : "text-caption leading-4",
        )}
      >
        {label}
      </span>
      <span className={cn("opacity-80", compact ? "text-micro leading-3" : "text-caption")}>
        {format}
      </span>
      {!compact && <span className="text-caption">{interval}</span>}
    </Link>
  );
}
