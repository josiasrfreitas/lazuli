import { ArrowLeftRight, TriangleAlert } from "lucide-react";
import { cn } from "@lazuli/ui";
import type { Meeting } from "./meeting-dialog";
import { dateLabel, hoursLabel } from "./format";

export function MeetingBlock({
  meeting,
  compact = false,
  teacherId,
  onOpen,
}: {
  meeting: Meeting;
  compact?: boolean;
  teacherId: string;
  onOpen: (meeting: Meeting) => void;
}) {
  const substitution =
    meeting.substituteTeacherId && meeting.substituteTeacherId !== meeting.usualTeacherId;
  const ceded = substitution && meeting.usualTeacherId === teacherId;
  const uncovered = meeting.requiresCoverage && !meeting.substituteTeacherId;
  const status = ceded ? "Substituído" : substitution ? "Substituição" : uncovered ? "Sem professor" : null;
  const modality = meeting.scheduleType === "REGULAR" ? "Regular" : "PPT";
  const format = meeting.format === "ONLINE" ? "Online" : "Presencial";
  const label = meeting.scheduleType === "PERSONALIZED" ? "PPT" : meeting.stageName ?? "Estágio não informado";
  const interval = `${meeting.startTime}–${meeting.endTime}`;
  const duration = `${hoursLabel(meeting.minutes)} ${meeting.minutes === 60 ? "hora-aula" : "horas-aula"}`;
  const replacement = ceded
    ? `Com ${meeting.substituteTeacherName}`
    : substitution && meeting.substituteTeacherId === teacherId && meeting.usualTeacherName
      ? `No lugar de ${meeting.usualTeacherName}`
      : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(meeting)}
      title={[meeting.classCode, modality, format, label, interval, duration, status, replacement].filter(Boolean).join(" · ")}
      aria-label={[meeting.classCode, modality, format, label, dateLabel(meeting.date), interval, duration, status, replacement].filter(Boolean).join(", ")}
      className={cn(
        "flex w-full min-w-0 flex-col text-left font-numeric transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        compact ? "min-h-0 flex-1 justify-center overflow-hidden px-2 py-0.5" : "gap-1 rounded-sm px-3 py-2",
        meeting.scheduleType === "REGULAR"
          ? "bg-info-muted text-info hover:bg-info/15"
          : "bg-success-muted text-success hover:bg-success/15",
      )}
    >
      <span className="flex w-full min-w-0 items-center gap-1">
        <span className={cn(
          "min-w-0 flex-1 truncate font-semibold",
          compact ? "text-xs leading-3.5" : "text-caption leading-4",
        )}>{label}</span>
        {uncovered ? (
          <TriangleAlert className="size-3 shrink-0 text-warning" aria-hidden="true" />
        ) : substitution ? (
          <ArrowLeftRight className="size-3 shrink-0" aria-hidden="true" />
        ) : null}
      </span>
      <span className={cn("opacity-80", compact ? "text-micro leading-3" : "text-caption")}>
        {format}
      </span>
      {!compact && status && <span className="text-caption">{status}</span>}

    </button>
  );
}
