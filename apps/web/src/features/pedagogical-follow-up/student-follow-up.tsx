"use client";
import Link from "next/link";
import { useState, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { ArrowUpRight, CalendarClock, MessageSquareText, Plus } from "lucide-react";
import { Button, cn, Tabs, TabsList, TabsPanel, TabsTab } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { today } from "~/features/appointments/shared";
import { ProfileRecordList } from "~/features/students/profile/profile-record-list";
import { CATEGORY, dateLabel, QueryState, StatusBadge, type OccurrenceRow } from "./shared";
import { StudentInterventionForm } from "./student-intervention-form";

type InterventionRow = RouterOutputs["interventions"]["list"]["rows"][number];

export function StudentFollowUp({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}): ReactElement {
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState("interventions");
  // Count each active status on the server, rather than counting a partial ALL page.
  const open = trpc.interventions.list.useQuery({ studentId, status: "OPEN" });
  const inProgress = trpc.interventions.list.useQuery({ studentId, status: "IN_PROGRESS" });
  const occurrences = trpc.occurrences.list.useQuery({ studentId });
  const ready = open.isSuccess && inProgress.isSuccess;
  const total = (open.data?.total ?? 0) + (inProgress.data?.total ?? 0);
  const active = [...(open.data?.rows ?? []), ...(inProgress.data?.rows ?? [])].sort(
    (a, b) =>
      (a.dueOn?.getTime() ?? Infinity) - (b.dueOn?.getTime() ?? Infinity) ||
      b.createdAt.getTime() - a.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );
  return (
    <section
      aria-label="Acompanhamento pedagógico do aluno"
      className="grid min-w-0 content-start gap-4 border-t border-border-strong pt-4 xl:col-span-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight text-heading">
            Acompanhamento pedagógico
          </h2>
          <p className="mt-1 text-caption text-muted-foreground">
            Intervenções, próximos passos e observações
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" /> Nova intervenção
        </Button>
      </div>
      <Tabs value={view} onValueChange={(value) => setView(String(value))} variant="underline">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList aria-label="Registros pedagógicos do aluno">
            <TabsTab value="interventions">Em aberto · {ready ? total : "…"}</TabsTab>
            <TabsTab value="occurrences">Ocorrências · {occurrences.data?.total ?? "…"}</TabsTab>
          </TabsList>
          <Button
            variant="link"
            size="inline"
            nativeButton={false}
            render={<Link href={`/acompanhamento?aluno=${studentId}&view=${view}`} />}
          >
            Histórico completo <ArrowUpRight aria-hidden="true" />
          </Button>
        </div>
        <TabsPanel value="interventions">
          <QueryState
            pending={open.isPending || inProgress.isPending}
            error={open.error ?? inProgress.error}
            retry={() => {
              void open.refetch();
              void inProgress.refetch();
            }}
          />
          {ready &&
            (active.length > 0 ? (
              <ProfileRecordList
                total={total}
                label="Intervenções em aberto, por prazo de revisão"
                previewCount={2}
                historyHref={`/acompanhamento?aluno=${studentId}&view=interventions`}
              >
                {active.map((row) => (
                  <li key={row.id}>
                    <InterventionItem row={row} />
                  </li>
                ))}
              </ProfileRecordList>
            ) : (
              <EmptyFollowUp>Sem intervenções em aberto.</EmptyFollowUp>
            ))}
        </TabsPanel>
        <TabsPanel value="occurrences">
          <QueryState
            pending={occurrences.isPending}
            error={occurrences.error}
            retry={() => void occurrences.refetch()}
          />
          {occurrences.isSuccess &&
            (occurrences.data.rows.length > 0 ? (
              <ProfileRecordList
                total={occurrences.data.total}
                label="Ocorrências recentes"
                previewCount={2}
                historyHref={`/acompanhamento?aluno=${studentId}&view=occurrences`}
              >
                {occurrences.data.rows.map((row) => (
                  <li key={row.id}>
                    <OccurrenceItem row={row} />
                  </li>
                ))}
              </ProfileRecordList>
            ) : (
              <EmptyFollowUp>Nenhuma ocorrência registrada.</EmptyFollowUp>
            ))}
        </TabsPanel>
      </Tabs>
      {creating && (
        <StudentInterventionForm
          student={{ id: studentId, name: studentName }}
          onClose={() => setCreating(false)}
        />
      )}
    </section>
  );
}

function EmptyFollowUp({ children }: { children: string }): ReactElement {
  return (
    <p className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
      <MessageSquareText aria-hidden="true" className="size-5 shrink-0 text-icon" />
      {children}
    </p>
  );
}

function InterventionItem({ row }: { row: InterventionRow }): ReactElement {
  const dueDate = row.dueOn?.toISOString().slice(0, 10);
  const overdue = dueDate && dueDate < today();
  return (
    <article className="grid gap-2 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p
          className={cn(
            "flex items-center gap-1.5 text-caption font-medium",
            overdue ? "text-warning" : "text-muted-foreground",
          )}
        >
          <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
          {row.dueOn ? (
            <>
              {overdue ? "Revisão em atraso" : "Revisar até"} ·{" "}
              <time dateTime={dueDate}>{dateLabel(row.dueOn)}</time>
            </>
          ) : (
            "Sem prazo definido"
          )}
        </p>
        <StatusBadge status={row.status} />
      </div>
      <Link
        href={`/acompanhamento/intervencoes/${row.id}`}
        className="group flex items-start justify-between gap-3 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <h3 className="line-clamp-2 break-words font-display text-xl font-medium leading-snug text-heading group-hover:text-interactive">
          {row.title}
        </h3>
        <ArrowUpRight className="mt-1 size-4 shrink-0 text-interactive" aria-hidden="true" />
      </Link>
      <p className="line-clamp-2 break-words text-sm leading-relaxed text-foreground">
        <span className="font-semibold">Próximo passo: </span>
        {row.nextStep}
      </p>
      <p className="truncate text-caption text-muted-foreground">{row.teacher.name}</p>
    </article>
  );
}

function OccurrenceItem({ row }: { row: OccurrenceRow }): ReactElement {
  return (
    <Link
      href={`/acompanhamento/ocorrencias/${row.id}`}
      className="group flex items-start gap-4 py-4 outline-offset-2 hover:text-interactive focus-visible:outline-2 focus-visible:outline-ring"
    >
      <time
        dateTime={row.classSession.date.toISOString().slice(0, 10)}
        className="shrink-0 pt-1 font-numeric text-caption tabular-nums text-muted-foreground"
      >
        {dateLabel(row.classSession.date)}
      </time>
      <div className="grid min-w-0 flex-1 gap-1">
        <h3 className="line-clamp-2 break-words font-display text-lg font-medium text-heading group-hover:text-interactive">
          {row.title}
        </h3>
        <p className="line-clamp-2 break-words text-sm text-muted-foreground">{row.account}</p>
        <p className="text-caption text-muted-foreground">
          {CATEGORY[row.category]} · {row.recordedBy.name}
        </p>
      </div>
      <ArrowUpRight className="mt-1 size-4 shrink-0 text-icon" aria-hidden="true" />
    </Link>
  );
}
