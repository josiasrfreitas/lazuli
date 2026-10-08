import type { ReactElement } from "react";
import { ArrowLeftRight, TriangleAlert } from "lucide-react";
import { cn } from "@lazuli/ui";
import type { Meeting } from "./meeting-dialog";
import { dateLabel, hoursLabel } from "./format";

const MINUTES_PER_HOUR = 60;
type MeetingBlockInput = {
  meeting: Meeting;
  compact?: boolean;
  teacherId: string;
  onOpen: (meeting: Meeting) => void;
};
type Coverage = {
  substitution: boolean;
  uncovered: boolean;
  status: string | null;
  replacement: string | null;
};
function coverageStatus(input: CoverageStatusInput): string | null {
  if (input.ceded) return "Substituído";
  if (input.substitution) return "Substituição";
  return input.uncovered ? "Sem professor" : null;
}
function replacementLabel(meeting: Meeting, teacherId: string): string | null {
  if (!meeting.substituteTeacherId || meeting.substituteTeacherId === meeting.usualTeacherId)
    return null;
  if (meeting.usualTeacherId === teacherId) return `Com ${meeting.substituteTeacherName}`;
  if (meeting.substituteTeacherId === teacherId && meeting.usualTeacherName)
    return `No lugar de ${meeting.usualTeacherName}`;
  return null;
}
function meetingCoverage(meeting: Meeting, teacherId: string): Coverage {
  const substitution = Boolean(
    meeting.substituteTeacherId && meeting.substituteTeacherId !== meeting.usualTeacherId,
  );
  const uncovered = Boolean(meeting.requiresCoverage && !meeting.substituteTeacherId);
  return {
    substitution,
    uncovered,
    status: coverageStatus({
      ceded: substitution && meeting.usualTeacherId === teacherId,
      substitution,
      uncovered,
    }),
    replacement: replacementLabel(meeting, teacherId),
  };
}
function meetingDescription(
  meeting: Meeting,
  coverage: Coverage,
): { label: string; format: string; title: string; accessible: string } {
  const modality = meeting.scheduleType === "REGULAR" ? "Regular" : "PPT";
  const format = meeting.format === "ONLINE" ? "Online" : "Presencial";
  const label =
    meeting.scheduleType === "PERSONALIZED"
      ? "PPT"
      : (meeting.stageName ?? "Estágio não informado");
  const interval = `${meeting.startTime}–${meeting.endTime}`;
  const duration = `${hoursLabel(meeting.minutes)} ${meeting.minutes === MINUTES_PER_HOUR ? "hora-aula" : "horas-aula"}`;
  const labels = [
    meeting.classCode,
    modality,
    format,
    label,
    interval,
    duration,
    coverage.status,
    coverage.replacement,
  ].filter(Boolean);
  const accessible = [
    meeting.classCode,
    modality,
    format,
    label,
    dateLabel(meeting.date),
    interval,
    duration,
    coverage.status,
    coverage.replacement,
  ]
    .filter(Boolean)
    .join(", ");
  return { label, format, title: labels.join(" · "), accessible };
}
export function MeetingBlock({
  meeting,
  compact = false,
  teacherId,
  onOpen,
}: MeetingBlockInput): ReactElement {
  const coverage = meetingCoverage(meeting, teacherId);
  const description = meetingDescription(meeting, coverage);
  return (
    <button
      type="button"
      onClick={() => onOpen(meeting)}
      title={description.title}
      aria-label={description.accessible}
      className={cn(
        "flex w-full min-w-0 flex-col text-left font-numeric transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        compact
          ? "min-h-0 flex-1 justify-center overflow-hidden px-2 py-0.5"
          : "gap-1 rounded-sm px-3 py-2",
        meeting.scheduleType === "REGULAR"
          ? "bg-info-muted text-info hover:bg-info/15"
          : "bg-success-muted text-success hover:bg-success/15",
      )}
    >
      <MeetingTitle label={description.label} compact={compact} coverage={coverage} />
      <span className={cn("opacity-80", compact ? "text-micro leading-3" : "text-caption")}>
        {description.format}
      </span>
      {!compact && coverage.status && <span className="text-caption">{coverage.status}</span>}
    </button>
  );
}
function MeetingTitle({ label, compact, coverage }: MeetingTitleInput): ReactElement {
  return (
    <span className="flex w-full min-w-0 items-center gap-1">
      <span
        className={cn(
          "min-w-0 flex-1 truncate font-semibold",
          compact ? "text-xs leading-3.5" : "text-caption leading-4",
        )}
      >
        {label}
      </span>
      <CoverageIcon coverage={coverage} />
    </span>
  );
}
function CoverageIcon({ coverage }: CoverageIconInput): ReactElement | null {
  if (coverage.uncovered)
    return <TriangleAlert className="size-3 shrink-0 text-warning" aria-hidden="true" />;
  if (coverage.substitution)
    return <ArrowLeftRight className="size-3 shrink-0" aria-hidden="true" />;
  return null;
}

type CoverageStatusInput = {
  ceded: boolean;
  substitution: boolean;
  uncovered: boolean;
};
type MeetingTitleInput = {
  label: string;
  compact: boolean;
  coverage: Coverage;
};
type CoverageIconInput = { coverage: Coverage };
