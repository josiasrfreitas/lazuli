"use client";
import { useState, type ReactElement } from "react";
import { ArrowLeft, History, Plus } from "lucide-react";
import { Badge, Button, EmptyState, Input } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { PlanWindowForm, PlanItemForm, PlanRemoveForm } from "./forms";
import { PlanHistory } from "./history";
import { PlanningState, PlanTable, dateLabel, type Planning, type PlannedItem } from "./shared";
import { ProgressSummary } from "./progress-summary";
import { PlanningRecords } from "./record-list";
import { PlanningLoading } from "./planning-loading";
import styles from "./planning.module.css";

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
  const [mode, setMode] = useState<Mode>(null);
  const [history, setHistory] = useState(false);
  const [view, setView] = useState<"plan" | "records">("plan");
  const [filter, setFilter] = useState(() =>
    data.plan?.items.some((item) => item.plannedOn >= data.scope.today) ? "upcoming" : "all",
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const { plan, scope } = data;
  const needle = search.trim().toLocaleLowerCase("pt-BR");
  const items = (plan?.items ?? []).filter(
    (item) =>
      (filter === "all" ||
        (filter === "upcoming" ? item.plannedOn >= scope.today : item.plannedOn < scope.today)) &&
      `${item.title} ${item.reference ?? ""} ${dateLabel(item.plannedOn)}`
        .toLocaleLowerCase("pt-BR")
        .includes(needle),
  );
  const records = data.records.filter((row) =>
    `${row.content.account} ${row.content.reference ?? ""} ${dateLabel(row.date)}`
      .toLocaleLowerCase("pt-BR")
      .includes(needle),
  );
  const count = view === "plan" ? items.length : records.length;
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const offset = currentPage * pageSize;
  const changeView = (next: "plan" | "records") => {
    setView(next);
    setPage(0);
    setHistory(false);
    setSearch("");
  };
  return (
    <>
      <section className={styles.workspace} aria-label="Planejamento do estágio">
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
            {plan && scope.student && !scope.readOnly && plan.plannedEndOn < scope.today && (
              <Badge variant="warning">Prazo planejado vencido</Badge>
            )}
            {plan && !scope.readOnly && (
              <Button size="sm" variant="ghost" onClick={() => setMode({ kind: "window" })}>
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
        {plan && <ProgressSummary data={data} onRecords={() => changeView("records")} />}
        <div className={styles.content}>
          <div className={styles.toolbar}>
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
                    Roteiro · {plan?.items.length ?? 0}
                  </Button>
                  <Button
                    size="sm"
                    variant={view === "records" ? "secondary" : "ghost"}
                    aria-pressed={view === "records"}
                    onClick={() => changeView("records")}
                  >
                    Aulas registradas · {data.records.length}
                  </Button>
                </div>
              )}
              {plan && history && <span>{`Versão atual ${plan.version}`}</span>}
            </div>
            {plan && (
              <div className={styles.actions}>
                {!history && (
                  <Button size="sm" variant="ghost" onClick={() => setHistory(true)}>
                    <History />
                    Versões
                  </Button>
                )}
                {!scope.readOnly && !history && view === "plan" && (
                  <Button size="sm" onClick={() => setMode({ kind: "item", item: null })}>
                    <Plus />
                    Adicionar atividade
                  </Button>
                )}
              </div>
            )}
          </div>
          {plan && !history && (
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
                      onClick={() => {
                        setFilter(value);
                        setPage(0);
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              )}
              <Input
                name="planning-search"
                size="sm"
                aria-label={view === "plan" ? "Buscar no roteiro" : "Buscar nos registros"}
                placeholder={
                  view === "plan" ? "Buscar conteúdo ou data…" : "Buscar relato ou data…"
                }
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
              />
            </div>
          )}
          {!plan ? (
            <div className={styles.empty}>
              <EmptyState
                title={
                  scope.readOnly
                    ? "Nenhum planejamento registrado"
                    : "Organize o roteiro deste estágio"
                }
                description={
                  scope.readOnly
                    ? "Este percurso não possui um plano de ensino registrado."
                    : scope.student
                      ? "Defina o período e distribua o conteúdo nas datas de aula da turma. O roteiro é individual."
                      : "Defina o período e distribua as atividades que a turma vai compartilhar."
                }
                action={
                  !scope.readOnly ? (
                    <Button onClick={() => setMode({ kind: "window" })}>
                      Iniciar planejamento
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : history ? (
            <div className={styles.history}>
              <PlanHistory data={data} />
            </div>
          ) : (
            <div className={styles.table}>
              {view === "records" ? (
                <PlanningRecords data={data} records={records.slice(offset, offset + pageSize)} />
              ) : (
                <PlanTable
                  items={items.slice(offset, offset + pageSize)}
                  filtered={Boolean(search.trim()) || filter !== "all"}
                  onEdit={scope.readOnly ? undefined : (item) => setMode({ kind: "item", item })}
                />
              )}
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
                    Próxima
                  </Button>
                </div>
              </div>
            </div>
          )}
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
