"use client";
import { useState, type ReactElement } from "react";
import { Badge, Button, EmptyState } from "@lazuli/ui";
import { CalendarDays, Plus } from "lucide-react";
import { trpc } from "~/lib/trpc";
import { PlanWindowForm, PlanItemForm, PlanRemoveForm } from "./forms";
import { PlanningState, dateLabel, type Planning, type PlannedItem } from "./shared";
import { ProgressSummary } from "./progress-summary";
import { PlanningLoading } from "./planning-loading";
import { PlanBrowser } from "./workspace-browser";
import styles from "./planning.module.css";
export type PlanMode =
  | { kind: "window" }
  | { kind: "item"; item: PlannedItem | null }
  | { kind: "remove"; item: PlannedItem }
  | null;
export type WorkspaceProps = { data: Planning; mode: (value: PlanMode) => void };
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
  if (query.isPending) return <PlanningLoading />;
  return (
    <>
      <PlanningState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && <PlanContent key={`${classId}/${progressId ?? "shared"}`} data={query.data} />}
    </>
  );
}
function PlanContent({ data }: { data: Planning }): ReactElement {
  const [mode, setMode] = useState<PlanMode>(null);
  const [view, setView] = useState<"plan" | "records">("plan");
  return (
    <>
      <section className={styles.workspace} aria-label="Planejamento do estágio">
        <PlanIdentity data={data} mode={setMode} />
        {data.plan && <ProgressSummary data={data} onRecords={() => setView("records")} />}
        {data.plan ? (
          <PlanBrowser data={data} mode={setMode} view={view} setView={setView} />
        ) : (
          <PlanEmpty data={data} mode={setMode} />
        )}
      </section>
      <PlanForms data={data} mode={mode} change={setMode} />
    </>
  );
}
function PlanIdentity({ data: { scope, plan }, mode }: WorkspaceProps): ReactElement {
  return (
    <header className={styles.context}>
      <div className={styles.identity}>
        <h2 className="sr-only">
          {scope.student ? `Planejamento · ${scope.stage.name}` : "Planejamento da turma"}
        </h2>
        <p>
          {plan
            ? `${dateLabel(plan.plannedStartOn)} — ${dateLabel(plan.plannedEndOn)}`
            : "Período ainda não definido"}
          {scope.student ? ` · ${scope.class.name}` : ""}
        </p>
      </div>
      <div className={styles.actions}>
        {scope.readOnly && <Badge variant="neutral">Somente consulta</Badge>}
        <PlanDeadline scope={scope} plan={plan} />
        {plan && !scope.readOnly && (
          <Button size="sm" variant="ghost" onClick={() => mode({ kind: "window" })}>
            <CalendarDays aria-hidden />
            Editar período e objetivo
          </Button>
        )}
      </div>
      {plan?.objective && (
        <details className={styles.objective}>
          <summary>Objetivo do estágio</summary>
          <p>{plan.objective}</p>
        </details>
      )}
    </header>
  );
}
function PlanEmpty({ data: { scope }, mode }: WorkspaceProps): ReactElement {
  const description = scope.student
    ? "Defina o período e distribua o conteúdo nas datas de aula da turma. O roteiro é individual."
    : "Defina o período e distribua as atividades que a turma vai compartilhar.";
  return (
    <div className={styles.empty}>
      <EmptyState
        title={
          scope.readOnly ? "Nenhum planejamento registrado" : "Organize o roteiro deste estágio"
        }
        description={
          scope.readOnly ? "Este percurso não possui um plano de ensino registrado." : description
        }
        action={
          scope.readOnly ? undefined : (
            <Button onClick={() => mode({ kind: "window" })}>
              <Plus aria-hidden />
              Iniciar planejamento
            </Button>
          )
        }
      />
    </div>
  );
}
function PlanForms({
  data,
  mode,
  change,
}: {
  data: Planning;
  mode: PlanMode;
  change: (mode: PlanMode) => void;
}): ReactElement | null {
  if (!mode) return null;
  const close = (): void => change(null);
  if (mode.kind === "window") return <PlanWindowForm data={data} onClose={close} />;
  if (mode.kind === "remove")
    return <PlanRemoveForm data={data} item={mode.item} onClose={close} />;
  return (
    <PlanItemForm
      data={data}
      item={mode.item}
      onClose={close}
      onRemove={(item) => change({ kind: "remove", item })}
    />
  );
}

function PlanDeadline({ scope, plan }: Pick<Planning, "scope" | "plan">): ReactElement | null {
  if (!plan || !scope.student || scope.readOnly || plan.plannedEndOn >= scope.today) return null;
  return <Badge variant="warning">Prazo planejado vencido</Badge>;
}
