"use client";
import type { ReactElement } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  History,
  Plus,
} from "lucide-react";
import { Badge, Button, EmptyState, Input } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { PlanWindowForm, PlanItemForm, PlanRemoveForm } from "./forms";
import { PlanHistory } from "./history";
import { PlanningState, PlanTable, dateLabel, type Planning } from "./shared";
import { ProgressSummary } from "./progress-summary";
import { PlanningRecords } from "./record-list";
import { PlanningLoading } from "./planning-loading";
import styles from "./planning.module.css";
import { usePlanContentModel, type PlanContentModel } from "./workspace-model";

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
  const model = usePlanContentModel(data);
  const { mode, setMode, history, changeView } = model;
  return (
    <>
      <section className={styles.workspace} aria-label="Planejamento do estágio">
        <PlanHeader data={data} onEdit={() => setMode({ kind: "window" })} />
        {data.plan && <ProgressSummary data={data} onRecords={() => changeView("records")} />}
        <div className={styles.content}>
          <PlanToolbar data={data} model={model} />
          {data.plan && !history && <PlanFilters model={model} />}
          <PlanResults data={data} model={model} />
        </div>
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
  const { plan, scope } = data;
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
      {plan && !scope.readOnly && (
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <CalendarDays aria-hidden="true" />
          Editar período e objetivo
        </Button>
      )}
    </div>
  );
}

function PlanToolbar({ data, model }: { data: Planning; model: PlanContentModel }): ReactElement {
  return (
    <div className={styles.toolbar}>
      <PlanToolbarHeading data={data} model={model} />
      {data.plan && <PlanToolbarActions data={data} model={model} />}
    </div>
  );
}

function PlanToolbarHeading({
  data,
  model,
}: {
  data: Planning;
  model: PlanContentModel;
}): ReactElement {
  const { history, view, changeView, setHistory } = model;
  return (
    <div className={styles.heading}>
      {history && (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Voltar ao roteiro"
          onClick={() => setHistory(false)}
        >
          <ArrowLeft />
        </Button>
      )}
      {history ? (
        <h3>Versões do plano</h3>
      ) : (
        <div className={styles.viewSwitch} role="group" aria-label="Visão do planejamento">
          <Button
            size="sm"
            variant={view === "plan" ? "secondary" : "ghost"}
            aria-pressed={view === "plan"}
            onClick={() => changeView("plan")}
          >
            <BookOpen aria-hidden="true" />
            Roteiro · {data.plan?.items.length ?? 0}
          </Button>
          <Button
            size="sm"
            variant={view === "records" ? "secondary" : "ghost"}
            aria-pressed={view === "records"}
            onClick={() => changeView("records")}
          >
            <FileText aria-hidden="true" />
            Aulas registradas · {data.records.length}
          </Button>
        </div>
      )}
      {data.plan && history && <span>{`Versão atual ${data.plan.version}`}</span>}
    </div>
  );
}

function PlanToolbarActions({
  data,
  model,
}: {
  data: Planning;
  model: PlanContentModel;
}): ReactElement {
  return (
    <div className={styles.actions}>
      {!model.history && (
        <Button size="sm" variant="ghost" onClick={() => model.setHistory(true)}>
          <History />
          Versões
        </Button>
      )}
      {!data.scope.readOnly && !model.history && model.view === "plan" && (
        <Button size="sm" onClick={() => model.setMode({ kind: "item", item: null })}>
          <Plus />
          Adicionar atividade
        </Button>
      )}
    </div>
  );
}

function PlanFilters({ model }: { model: PlanContentModel }): ReactElement {
  const { view, filter, changeFilter, search, changeSearch } = model;
  return (
    <div className={styles.filters}>
      {view === "plan" && (
        <div className={styles.actions} role="group" aria-label="Período do roteiro">
          {(
            [
              ["all", "Todo o roteiro"],
              ["upcoming", "De hoje em diante"],
              ["past", "Datas anteriores"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={filter === value ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={filter === value}
              onClick={() => changeFilter(value)}
            >
              <CalendarDays aria-hidden="true" />
              {label}
            </Button>
          ))}
        </div>
      )}
      <Input
        name="planning-search"
        size="sm"
        aria-label={view === "plan" ? "Buscar no roteiro" : "Buscar nos registros"}
        placeholder={view === "plan" ? "Buscar conteúdo ou data…" : "Buscar relato ou data…"}
        value={search}
        onChange={(event) => changeSearch(event.target.value)}
      />
    </div>
  );
}

function PlanResults({ data, model }: { data: Planning; model: PlanContentModel }): ReactElement {
  if (!data.plan) return <EmptyPlan data={data} model={model} />;
  if (model.history) {
    return (
      <div className={styles.history}>
        <PlanHistory data={data} />
      </div>
    );
  }
  return <PlanTableResults data={data} model={model} />;
}

function PlanTableResults({
  data,
  model,
}: {
  data: Planning;
  model: PlanContentModel;
}): ReactElement {
  const { view, records, items, offset, pageSize, search, filter, setMode } = model;
  return (
    <div className={styles.table}>
      {view === "records" ? (
        <PlanningRecords data={data} records={records.slice(offset, offset + pageSize)} />
      ) : (
        <PlanTable
          items={items.slice(offset, offset + pageSize)}
          filtered={Boolean(search.trim()) || filter !== "all"}
          onEdit={data.scope.readOnly ? undefined : (item) => setMode({ kind: "item", item })}
        />
      )}
      <PlanPagination model={model} />
    </div>
  );
}

function PlanPagination({ model }: { model: PlanContentModel }): ReactElement {
  const { count, offset, pageSize, currentPage, pageCount, setPage } = model;
  return (
    <div className={styles.pagination}>
      <span>
        {count
          ? `${offset + 1}–${Math.min(offset + pageSize, count)} de ${count}`
          : "Nenhum resultado"}
      </span>
      <div className={styles.actions}>
        <Button
          variant="ghost"
          size="sm"
          disabled={currentPage === 0}
          onClick={() => setPage(currentPage - 1)}
        >
          <ChevronLeft aria-hidden="true" />
          Anterior
        </Button>
        <span>
          {currentPage + 1} / {pageCount}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={currentPage + 1 >= pageCount}
          onClick={() => setPage(currentPage + 1)}
        >
          <ChevronRight aria-hidden="true" />
          Próxima
        </Button>
      </div>
    </div>
  );
}

function EmptyPlan({ data, model }: { data: Planning; model: PlanContentModel }): ReactElement {
  const { scope } = data;
  let description = "Defina o período e distribua as atividades que a turma vai compartilhar.";
  if (scope.readOnly) description = "Este percurso não possui um plano de ensino registrado.";
  else if (scope.student) {
    description =
      "Defina o período e distribua o conteúdo nas datas de aula da turma. O roteiro é individual.";
  }
  return (
    <div className={styles.empty}>
      <EmptyState
        title={
          scope.readOnly ? "Nenhum planejamento registrado" : "Organize o roteiro deste estágio"
        }
        description={description}
        action={
          scope.readOnly ? undefined : (
            <Button onClick={() => model.setMode({ kind: "window" })}>
              <Plus aria-hidden="true" />
              Iniciar planejamento
            </Button>
          )
        }
      />
    </div>
  );
}
