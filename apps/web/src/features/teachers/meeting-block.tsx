import { Badge } from "@lazuli/ui";
import type { Meeting } from "./meeting-dialog";
import { hourSegments } from "./week-layout";
export function MeetingBlock({
  meeting,
  teacherId,
  onOpen,
}: {
  meeting: Meeting;
  teacherId: string;
  onOpen: (meeting: Meeting) => void;
}) {
  const substitution =
    meeting.substituteTeacherId && meeting.substituteTeacherId !== meeting.usualTeacherId;
  const ceded = substitution && meeting.usualTeacherId === teacherId;
  const uncovered = meeting.requiresCoverage && !meeting.substituteTeacherId;
  return (
    <button
      type="button"
      onClick={() => onOpen(meeting)}
      className="group flex w-full min-w-0 flex-col overflow-hidden rounded-md border border-border-strong bg-background text-left shadow-sm transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="grid gap-1 px-3 py-2">
        <span className="break-words text-control font-semibold">{meeting.classCode}</span>
        {ceded ? (
          <Badge variant="info">Substituído</Badge>
        ) : substitution ? (
          <Badge variant="info">Substituição</Badge>
        ) : uncovered ? (
          <Badge variant="warning">Sem professor</Badge>
        ) : null}
        {ceded && (
          <span className="break-words text-caption text-muted-foreground">
            Com {meeting.substituteTeacherName}
          </span>
        )}
        {substitution && meeting.substituteTeacherId === teacherId && meeting.usualTeacherName && (
          <span className="break-words text-caption text-muted-foreground">
            No lugar de {meeting.usualTeacherName}
          </span>
        )}
      </span>
      <span className="divide-y divide-border border-t border-border">
        {hourSegments(meeting).map((segment) => (
          <span
            key={segment.start}
            className="flex min-h-11 items-center bg-muted/30 px-2 py-2 font-numeric text-caption tabular-nums"
          >
            <span className="whitespace-nowrap">
              {segment.start}–{segment.end}
            </span>
          </span>
        ))}
      </span>
    </button>
  );
}
