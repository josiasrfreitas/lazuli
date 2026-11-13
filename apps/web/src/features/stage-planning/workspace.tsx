"use client";
import { useEffect, useState, type ReactElement } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { Badge, Button, EmptyState } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { PlanWindowForm, PlanItemForm, PlanRemoveForm } from "./forms";
import { PlanningState, dateLabel, type Planning } from "./shared";
import { PlanningJourney } from "./journey";
import { PlanningLoading } from "./planning-loading";
import styles from "./planning.module.css";
import type { PlannedItem } from "./shared";

type PlanMode =
  | { kind: "window" }
  | { kind: "item"; item: PlannedItem | null }
  | { kind: "remove"; item: PlannedItem }
  | null;

type WorkspaceProps = { classId: string; progressId?: string | undefined };
export function PlanningWorkspace(props: WorkspaceProps): ReactElement {
  return (
    <PlanningWorkspaceContent key={`${props.classId}/${props.progressId ?? "shared"}`} {...props} />
  );
}
function PlanningWorkspaceContent({ classId, progressId }: WorkspaceProps): ReactElement {
  const query = trpc.planning.detail.useQuery(
    { classId, ...(progressId ? { progressId } : {}) },
    { retry: false },
  );
  const prepare = trpc.planning.prepare.useMutation({ onSuccess: () => query.refetch() });
  useEffect(() => {
    if (
      query.data &&
      !query.data.plan &&
      !query.data.preview &&
      !query.data.scope.readOnly &&
      prepare.isIdle
    )
      prepare.mutate({ classId, ...(progressId ? { progressId } : {}) });
  }, [query.data, classId, progressId, prepare.isIdle, prepare.mutate]);
  if (
    query.isPending ||
    prepare.isPending ||
    (query.data &&
      !query.data.plan &&
      !query.data.preview &&
      !query.data.scope.readOnly &&
      prepare.isIdle)
  )
    return <PlanningLoading />;
  return (
    <>
      <PlanningState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {prepare.error && !query.data?.plan && (
        <p role="alert" className="text-sm text-destructive">
          {prepare.error.message}
        </p>
      )}
      {query.data && <PlanContent key={`${classId}/${progressId ?? "shared"}`} data={query.data} />}
    </>
  );
}

function PlanContent({ data }: { data: Planning }): ReactElement {
  const [mode, setMode] = useState<PlanMode>(null);
  return (
    <>
      <section className={styles.workspace} aria-label="Planejamento do estágio">
        <PlanHeader data={data} onEdit={() => setMode({ kind: "window" })} />
        {data.plan || data.preview ? (
          <PlanningJourney
            data={data}
            onEdit={
              !data.plan ||
              data.scope.readOnly ||
              data.plan.items.some((item) => item.programActivityId)
                ? undefined
                : (item) => setMode({ kind: "item", item })
            }
          />
        ) : (
          <EmptyPlan data={data} onStart={() => setMode({ kind: "window" })} />
        )}
      </section>
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

function PlanHeader({ data, onEdit }: { data: Planning; onEdit: () => void }): ReactElement {
  const { plan, preview, scope } = data;
  return (
    <header className={styles.context}>
      <div className={styles.identity}>
        <h2>{scope.student ? `Planejamento · ${scope.stage.name}` : "Planejamento da turma"}</h2>
        <p>
          {plan || preview
            ? `${dateLabel((plan ?? preview)!.plannedStartOn)} — ${dateLabel(scope.semester.endOn)} · ${scope.stage.track.name}`
            : "Período ainda não definido"}
          {scope.student ? ` · ${scope.class.name}` : ""}
        </p>
      </div>
      <PlanHeaderActions data={data} onEdit={onEdit} />
      {plan?.objective && (
        <details className={styles.objective}>
          <summary>Objetivo do estágio</summary>
          <p>{plan.objective}</p>
        </details>
      )}
    </header>
  );
}

function PlanHeaderActions({ data, onEdit }: { data: Planning; onEdit: () => void }): ReactElement {
  const { plan, scope } = data;
  return (
    <div className={styles.actions}>
      {scope.readOnly && <Badge variant="neutral">Somente consulta</Badge>}
      {plan && scope.student && !scope.readOnly && plan.plannedEndOn < scope.today && (
        <Badge variant="warning">Prazo planejado vencido</Badge>
      )}
      {(plan || data.preview) && !scope.readOnly && (
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <CalendarDays aria-hidden="true" />
          Alterar início
        </Button>
      )}
    </div>
  );
}

function EmptyPlan({ data, onStart }: { data: Planning; onStart: () => void }): ReactElement {
  const { scope } = data;
  let description =
    "O roteiro segue a programação do estágio e as aulas disponíveis até o fim do semestre.";
  if (scope.readOnly) description = "Este percurso não possui um plano de ensino registrado.";
  else if (scope.student) {
    description =
      "A programação do estágio segue o início do percurso do aluno e o fim do semestre.";
  }
  return (
    <div className={styles.empty}>
      <EmptyState
        title={scope.readOnly ? "Nenhum planejamento registrado" : "Programação do estágio"}
        description={description}
        action={
          scope.readOnly ? undefined : (
            <Button onClick={onStart}>
              <Plus aria-hidden="true" />
              Definir início
            </Button>
          )
        }
      />
    </div>
  );
}
