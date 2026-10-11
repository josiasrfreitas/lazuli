import type { ReactElement } from "react";
import Link from "next/link";
import { BookOpen, Building2, ChevronDown, CircleDollarSign, MessagesSquare } from "lucide-react";
import { Avatar, Badge } from "@lazuli/ui";
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
    return <p className="mt-2 break-words text-body text-muted-foreground">{description}</p>;
  }
  return (
    <details className="group mt-3">
      <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 text-caption font-medium text-info outline-offset-4 sm:min-h-8 [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Ver detalhes</span>
        <span className="hidden group-open:inline">Ocultar detalhes</span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <p className="mt-1 whitespace-pre-wrap break-words border-l-2 border-border pl-3 text-body leading-relaxed text-muted-foreground">
        {description}
      </p>
    </details>
  );
}

function ActivityEntry({ row }: { row: Activity }): ReactElement {
  const Icon = icons[row.area as keyof typeof icons] ?? Building2;
  return (
    <li className="relative flex min-w-0 gap-3 pb-7 last:pb-2 sm:gap-4" data-activity-id={row.id}>
      <span aria-hidden="true" className="absolute bottom-0 left-4 top-8 w-px bg-border" />
      <span className="relative flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-background text-icon">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <article className="min-w-0 flex-1 pt-1" aria-label={`${row.title} · ${row.subjectName}`}>
        <ActivityIdentity row={row} />
        {row.description && <ActivityContext description={row.description} />}
      </article>
    </li>
  );
}

function ActivityIdentity({ row }: { row: Activity }): ReactElement {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-body font-semibold text-heading">{row.title}</h3>
        <time
          dateTime={row.occurredAt.toISOString()}
          title={activityTimestamp(row.occurredAt)}
          className="font-numeric text-caption tabular-nums text-muted-foreground"
        >
          {activityTime(row.occurredAt)}
        </time>
      </div>
      {row.href ? (
        <Link
          href={row.href}
          className="inline-flex min-h-11 items-center break-words text-body text-info underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring sm:min-h-7"
        >
          {row.subjectName}
        </Link>
      ) : (
        <p className="mt-1 break-words text-body">{row.subjectName}</p>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <Avatar name={row.actorName} colorKey={row.actorId ?? row.actorName} size="sm" />
          {row.actorName}
        </span>
        <Badge variant="neutral">{row.areaLabel}</Badge>
      </div>
    </>
  );
}

export function ActivityTimeline({ rows }: { rows: Activity[] }): ReactElement {
  return (
    <div className="space-y-7">
      {activityDays(rows, new Date()).map((day) => (
        <section key={day.key} aria-labelledby={`activity-day-${day.key}`}>
          <header className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2
              id={`activity-day-${day.key}`}
              className="font-display text-h3 font-semibold text-heading"
            >
              {day.label}
            </h2>
            {day.label !== day.date && (
              <span className="text-caption text-muted-foreground">{day.date}</span>
            )}
          </header>
          <ol aria-label={`Atividades de ${day.date}`}>
            {day.rows.map((row) => (
              <ActivityEntry key={row.id} row={row} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
