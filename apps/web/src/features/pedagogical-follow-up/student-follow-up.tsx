"use client";
import Link from "next/link";
import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { ArrowUpRight, CalendarClock, MessageSquareText } from "lucide-react";
import { Button, cn } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { today } from "~/features/appointments/shared";
import { CATEGORY, dateLabel, QueryState, StatusBadge, type OccurrenceRow } from "./shared";

type InterventionRow = RouterOutputs["interventions"]["list"]["rows"][number];
export function StudentFollowUp({ studentId }: { studentId: string }): ReactElement {
  const interventions = trpc.interventions.list.useQuery({ studentId });
  const occurrences = trpc.occurrences.list.useQuery({ studentId });
  const active = interventions.data?.rows.filter((row) => row.status !== "CONCLUDED") ?? [];
  return (
    <section className="grid min-w-0 content-start gap-4 border-t border-border p-5 xl:border-l xl:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-heading">
            Acompanhamento pedagógico
          </h2>
          <p className="mt-1 text-caption text-muted-foreground">
            Intervenções e observações em sala
          </p>
        </div>
        <Button
          variant="link"
          size="inline"
          nativeButton={false}
          render={<Link href={`/acompanhamento?aluno=${studentId}`} />}
        >
          Ver histórico <ArrowUpRight aria-hidden="true" />
        </Button>
      </div>
      <QueryState
        pending={interventions.isPending || occurrences.isPending}
        error={interventions.error ?? occurrences.error}
        retry={() => {
          void interventions.refetch();
          void occurrences.refetch();
        }}
      />
      {active.map((row) => (
        <InterventionItem key={row.id} row={row} />
      ))}
      {interventions.data && !active.length && (
        <p className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
          <MessageSquareText aria-hidden="true" className="size-5 shrink-0 text-icon" />
          Sem intervenções em aberto.
        </p>
      )}
      {occurrences.data && occurrences.data.rows.length > 0 && (
        <RecentOccurrences
          rows={occurrences.data.rows.slice(0, 3)}
          total={occurrences.data.total}
        />
      )}
    </section>
  );
}
function InterventionItem({ row }: { row: InterventionRow }): ReactElement {
  const dueDate = row.dueOn?.toISOString().slice(0, 10);
  const overdue = dueDate && dueDate < today();
  return (
    <Link
      href={`/acompanhamento/intervencoes/${row.id}`}
      className="group grid gap-3 border-b border-border pb-4 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <h3 className="font-display text-lg font-medium leading-snug text-heading group-hover:text-interactive">
        {row.title}
      </h3>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-caption text-muted-foreground">Intervenção · {row.teacher.name}</span>
        <StatusBadge status={row.status} />
      </div>
      <div className="grid gap-1">
        <p className="text-caption font-semibold text-heading">Próximo passo</p>
        <p className="text-sm leading-relaxed text-foreground">{row.nextStep}</p>
      </div>
      {row.dueOn && (
        <p
          className={cn(
            "flex items-center gap-2 text-caption",
            overdue ? "text-warning" : "text-muted-foreground",
          )}
        >
          <CalendarClock className="size-3.5" aria-hidden="true" />
          {overdue ? "Revisão em atraso" : "Revisar até"} · {dateLabel(row.dueOn)}
          <ArrowUpRight className="ml-auto size-3.5 text-icon" aria-hidden="true" />
        </p>
      )}
    </Link>
  );
}
function RecentOccurrences({
  rows,
  total,
}: {
  rows: OccurrenceRow[];
  total: number;
}): ReactElement {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-heading">Ocorrências recentes</h3>
        <span className="text-caption text-muted-foreground">{total} no histórico</span>
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={`/acompanhamento/ocorrencias/${row.id}`}
            className="flex items-start gap-4 py-3 outline-offset-4 hover:text-interactive focus-visible:outline-2 focus-visible:outline-ring"
          >
            <time className="w-10 shrink-0 pt-0.5 font-numeric text-caption tabular-nums text-muted-foreground">
              {dateLabel(row.classSession.date).slice(0, 5)}
            </time>
            <div className="grid min-w-0 gap-1">
              <h4 className="text-sm font-medium">{row.title}</h4>
              <p className="text-caption text-muted-foreground">
                {CATEGORY[row.category]} · {row.recordedBy.name}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
