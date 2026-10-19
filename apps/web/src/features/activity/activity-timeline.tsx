import type { ReactElement } from "react";
import Link from "next/link";
import { BookOpen, Building2, ChevronDown, CircleDollarSign, MessagesSquare } from "lucide-react";
import { Avatar, Badge, Timeline } from "@lazuli/ui";
import { activityDays, activityTime, activityTimestamp, type Activity } from "./activity-format";

const icons = {
  PEDAGOGICAL: BookOpen,
  COMMERCIAL: MessagesSquare,
  FINANCIAL: CircleDollarSign,
  SCHOOL: Building2,
};
const SUMMARY_LENGTH = 160;

function ActivityContext({ description }: { description: string }): ReactElement {
  if (description.length <= SUMMARY_LENGTH && !description.includes("\n")) {
    return <p className="mt-2 break-words text-caption text-muted-foreground">{description}</p>;
  }
  return (
    <details className="group mt-2">
      <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 text-caption font-medium text-info outline-offset-4 sm:min-h-8 [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Ver detalhes</span>
        <span className="hidden group-open:inline">Ocultar detalhes</span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <p className="mt-1 whitespace-pre-wrap break-words text-caption leading-relaxed text-muted-foreground">
        {description}
      </p>
    </details>
  );
}

function ActivitySubject({ row }: { row: Activity }): ReactElement {
  return (
    <>
      {row.href ? (
        <Link
          href={row.href}
          className="inline-flex min-h-11 max-w-full items-center break-words text-body text-info underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring sm:min-h-7"
        >
          {row.subjectName}
        </Link>
      ) : (
        <p className="break-words text-body">{row.subjectName}</p>
      )}
      {row.description && <ActivityContext description={row.description} />}
    </>
  );
}

export function ActivityTimeline({ rows }: { rows: Activity[] }): ReactElement {
  return (
    <Timeline
      layout="alternating"
      groups={activityDays(rows, new Date()).map((day) => ({
        id: day.key,
        label: day.label,
        description: day.label !== day.date ? day.date : undefined,
        items: day.rows.map((row) => {
          const Icon = icons[row.area as keyof typeof icons] ?? Building2;
          return {
            id: row.id,
            icon: <Icon />,
            title: row.title,
            metadata: <Badge variant="neutral">{row.areaLabel}</Badge>,
            timestamp: (
              <time
                dateTime={row.occurredAt.toISOString()}
                title={activityTimestamp(row.occurredAt)}
              >
                {activityTime(row.occurredAt)}
              </time>
            ),
            children: <ActivitySubject row={row} />,
            footer: (
              <>
                <Avatar name={row.actorName} colorKey={row.actorId ?? row.actorName} size="sm" />
                <span>
                  Registrado por <span className="text-foreground">{row.actorName}</span>
                </span>
              </>
            ),
          };
        }),
      }))}
    />
  );
}
