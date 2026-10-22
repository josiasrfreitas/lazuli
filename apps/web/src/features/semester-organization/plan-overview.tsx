import type { JSX as ReactJSX } from "react";
import { ArrowRight, Users } from "lucide-react";
import { Badge, EmptyState } from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import {
  dateOnly,
  scheduleLabel,
  type ClassPlan,
  type Placement,
  type SemesterBoard,
} from "./shared";

export function PlanOverview({
  board,
  onSelect,
}: {
  board: SemesterBoard;
  onSelect: (id: string) => void;
}): ReactJSX.Element {
  const unassigned = board.placements.filter((row) => !row.planId);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-caption text-muted-foreground">
          {board.plans.length} turmas planejadas · entrada em{" "}
          {formatDateOnlyBR(dateOnly(board.semester.startDate))}
        </p>
        <p className="text-micro text-muted-foreground">
          Publicação parcial · referência de 25 alunos por turma
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {board.plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            rows={board.placements.filter((row) => row.planId === plan.id)}
            onSelect={onSelect}
          />
        ))}
      </div>
      {unassigned.length > 0 && <UnassignedCard count={unassigned.length} onSelect={onSelect} />}
      {board.plans.length === 0 && (
        <EmptyState
          title="O próximo semestre começa aqui"
          description="Planeje a primeira turma e organize os alunos conforme os horários e o percurso de cada um."
        />
      )}
    </div>
  );
}

function PlanCard({
  plan,
  rows,
  onSelect,
}: {
  plan: ClassPlan;
  rows: Placement[];
  onSelect: (id: string) => void;
}): ReactJSX.Element {
  const published = rows.filter((row) => row.publishedAt).length;
  const pending = rows.filter((row) => row.blockers.length).length;
  return (
    <button
      type="button"
      onClick={() => onSelect(plan.id)}
      className="group grid content-start gap-5 rounded-md border border-border bg-card p-5 text-left transition-colors hover:border-interactive focus-visible:outline-none focus-visible:shadow-focus"
    >
      <PlanCardHeader plan={plan} />
      <div className="grid gap-1">
        <p className="text-caption">{plan.teacherName ?? "Professor a definir"}</p>
        <p className="text-caption text-muted-foreground">{scheduleLabel(plan.slots)}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <span className="inline-flex items-center gap-2 text-caption">
          <Users className="size-4 text-muted-foreground" />
          {rows.length} {rows.length === 1 ? "aluno" : "alunos"} · {published} publicados
        </span>
        <span className="text-micro text-muted-foreground">{planStatus({ pending, rows })}</span>
      </div>
      {plan.draftConflicts.length > 0 && (
        <p className="text-caption text-warning-foreground">
          Conflito entre propostas do professor
        </p>
      )}
    </button>
  );
}

function PlanCardHeader({ plan }: { plan: ClassPlan }): ReactJSX.Element {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant={plan.classId ? "info" : "neutral"}>
            {plan.classId ? "Publicação iniciada" : "Em preparação"}
          </Badge>
          <span className="text-micro text-muted-foreground">
            {plan.scheduleType === "PERSONALIZED" ? "PPT" : plan.stageCode} ·{" "}
            {plan.format === "ONLINE" ? "Online" : "Presencial"}
          </span>
        </div>
        <h3 className="font-display text-h4 font-semibold text-heading">{plan.name}</h3>
      </div>
      <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-interactive" />
    </div>
  );
}

function UnassignedCard({
  count,
  onSelect,
}: {
  count: number;
  onSelect: (id: string) => void;
}): ReactJSX.Element {
  return (
    <button
      type="button"
      onClick={() => onSelect("unassigned")}
      className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border p-4 text-left focus-visible:outline-none focus-visible:shadow-focus"
    >
      <div>
        <p className="text-caption font-semibold">
          {count} {count === 1 ? "aluno ainda sem turma" : "alunos ainda sem turma"}
        </p>
        <p className="mt-1 text-caption text-muted-foreground">
          Acompanhe decisões de estágio e propostas que precisam de um destino.
        </p>
      </div>
      <ArrowRight className="size-4 shrink-0" />
    </button>
  );
}

function planStatus({ pending, rows }: { pending: number; rows: Placement[] }): string {
  if (pending) return `${pending} ${pending === 1 ? "pendente" : "pendentes"}`;
  return rows.length > 0 ? "Tudo conferido" : "A compor";
}
