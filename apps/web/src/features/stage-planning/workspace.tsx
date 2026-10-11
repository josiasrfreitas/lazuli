"use client";
import { useState, type ReactElement } from "react";
import Link from "next/link";
import { Plus, CalendarDays, ArrowUpRight, BookOpen } from "lucide-react";
import { Alert, Badge, Button, EmptyState, Tabs, TabsList, TabsTab } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { PlanWindowForm, PlanItemForm, PlanRemoveForm } from "./forms";
import { PlanHistory } from "./history";
import { PlanningState, PlanTable, dateLabel, type Planning, type PlannedItem } from "./shared";
type Mode =
  | { kind: "window" }
  | { kind: "item"; item: PlannedItem | null }
  | { kind: "remove"; item: PlannedItem }
  | null;
export function PlanningWorkspace({
  classId,
  progressId,
}: {
  classId: string;
  progressId?: string | undefined;
}): ReactElement {
  const query = trpc.planning.detail.useQuery(
    { classId, ...(progressId ? { progressId } : {}) },
    { retry: false },
  );
  return (
    <>
      <PlanningState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && <PlanContent data={query.data} />}
    </>
  );
}
function PlanContent({ data }: { data: Planning }): ReactElement {
  const [mode, setMode] = useState<Mode>(null);
  const [view, setView] = useState("plan");
  const { plan, scope } = data;
  const me = trpc.me.useQuery();
  const isAdmin = me.data?.role === "ADMIN" || me.data?.role === "SYSTEM_ADMIN";
  return (
    <>
      <section className="grid gap-5 rounded-lg border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <span className="text-micro font-semibold uppercase tracking-label text-muted-foreground">
              {scope.student ? "Plano individual · PPT" : "Cronograma compartilhado · Regular"}
            </span>
            <h2 className="font-display text-h2 font-semibold text-heading">
              {scope.student?.fullName ?? scope.stage.name}
            </h2>
            <p className="text-caption text-muted-foreground">
              {scope.student ? `${scope.stage.name} · ` : ""}
              {scope.stage.track.name} · {scope.semester.name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {scope.readOnly && <Badge variant="neutral">Histórico</Badge>}
            {plan && !scope.readOnly && (
              <Button
                size="compact-responsive"
                onClick={() => setMode({ kind: "item", item: null })}
              >
                <Plus />
                Adicionar atividade
              </Button>
            )}
          </div>
        </div>
        {plan && <PlanOverview data={data} onRevise={() => setMode({ kind: "window" })} />}
        {isAdmin && (
          <div className="flex flex-wrap gap-4 text-caption">
            <Link
              className="inline-flex items-center gap-1 text-interactive hover:underline"
              href={`/turmas/${scope.class.id}`}
            >
              {scope.class.name}
              <ArrowUpRight className="size-3.5" />
            </Link>
            {scope.student && (
              <Link
                className="inline-flex items-center gap-1 text-interactive hover:underline"
                href={`/alunos/${scope.student.id}`}
              >
                Perfil do aluno
                <ArrowUpRight className="size-3.5" />
              </Link>
            )}
          </div>
        )}
      </section>
      {!plan ? (
        <EmptyState
          icon={<BookOpen />}
          title="Planeje os próximos passos"
          description={
            scope.student
              ? "Defina o período deste estágio e organize as atividades no ritmo do aluno."
              : "Defina o período e organize as atividades que a turma vai compartilhar."
          }
          action={
            !scope.readOnly ? (
              <Button onClick={() => setMode({ kind: "window" })}>Iniciar planejamento</Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Tabs value={view} variant="underline" onValueChange={setView}>
            <TabsList aria-label="Visões do planejamento">
              <TabsTab value="plan">Roteiro · {plan.items.length}</TabsTab>
              <TabsTab value="history">Versões · {plan.version}</TabsTab>
            </TabsList>
          </Tabs>
          {view === "plan" ? (
            <div className="grid min-w-0 gap-4">
              <UpcomingDates data={data} />
              <PlanTable
                items={plan.items}
                onEdit={scope.readOnly ? undefined : (item) => setMode({ kind: "item", item })}
              />
            </div>
          ) : (
            <PlanHistory data={data} />
          )}
        </>
      )}
      {mode?.kind === "window" && <PlanWindowForm data={data} onClose={() => setMode(null)} />}
      {mode?.kind === "item" && (
        <PlanItemForm
          data={data}
          item={mode.item}
          onClose={() => setMode(null)}
          onRemove={(item) => setMode({ kind: "remove", item })}
        />
      )}
      {mode?.kind === "remove" && (
        <PlanRemoveForm data={data} item={mode.item} onClose={() => setMode(null)} />
      )}
    </>
  );
}
function PlanOverview({ data, onRevise }: { data: Planning; onRevise: () => void }): ReactElement {
  const plan = data.plan!;
  const pastDeadline =
    data.scope.student && !data.scope.readOnly && plan.plannedEndOn < data.scope.today;
  const dates = new Set(plan.items.map((item) => item.plannedOn));
  return (
    <>
      <dl className="grid gap-4 border-y border-border py-4 sm:grid-cols-3">
        <div>
          <dt className="text-caption text-muted-foreground">Período planejado</dt>
          <dd className="mt-1 font-numeric text-sm font-semibold tabular-nums">
            {dateLabel(plan.plannedStartOn)} — {dateLabel(plan.plannedEndOn)}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Roteiro previsto</dt>
          <dd className="mt-1 text-sm font-semibold">
            {plan.items.length} {plan.items.length === 1 ? "atividade" : "atividades"}{" "}
            <span className="font-normal text-muted-foreground">
              em {dates.size} {dates.size === 1 ? "data" : "datas"}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Planejamento atual</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold">Versão {plan.version}</span>
            {!data.scope.readOnly && (
              <Button size="sm" variant="ghost" onClick={onRevise}>
                Revisar período
              </Button>
            )}
          </dd>
        </div>
      </dl>
      {plan.objective && (
        <p className="max-w-3xl whitespace-pre-wrap text-sm leading-relaxed">{plan.objective}</p>
      )}
      {pastDeadline && (
        <Alert variant="warning">
          O prazo planejado passou. Revise o roteiro com o professor responsável; a conclusão do
          estágio depende da avaliação pedagógica.
        </Alert>
      )}
    </>
  );
}
function UpcomingDates({ data }: { data: Planning }): ReactElement | null {
  if (data.scope.readOnly || !data.upcoming.length) return null;
  return (
    <aside className="flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-muted-foreground">
      <span className="inline-flex items-center gap-2 font-medium">
        <CalendarDays className="size-4" />
        Próximos encontros da turma
      </span>
      <span>
        {data.upcoming
          .map((session) => `${dateLabel(session.date).slice(0, 5)} · ${session.time}`)
          .join("  /  ")}
      </span>
    </aside>
  );
}
