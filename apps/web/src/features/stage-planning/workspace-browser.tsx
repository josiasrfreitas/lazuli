import { useState, type ReactElement } from "react";
import { ArrowLeft, BookOpen, CalendarDays, FileText, History, Plus } from "lucide-react";
import { Button, Input, type TablePaginationConfig } from "@lazuli/ui";
import { PlanHistory } from "./history";
import { PlanTable, dateLabel, type Planning } from "./shared";
import { PlanningRecords } from "./record-list";
import type { PlannedItem } from "./shared";
type WorkspaceProps = {
  data: Planning;
  mode: (mode: { kind: "window" } | { kind: "item"; item: PlannedItem | null }) => void;
};
import styles from "./planning.module.css";
type View = "plan" | "records";
type Filter = "all" | "upcoming" | "past";
type Browse = { history: boolean; filter: Filter; search: string; page: number };
type BrowserProps = WorkspaceProps & { view: View; setView: (view: View) => void };
type Controls = BrowserProps & { state: Browse; update: (patch: Partial<Browse>) => void };
const PAGE_SIZE = 8;
const FILTERS = [
  ["all", "Todo o roteiro"],
  ["upcoming", "De hoje em diante"],
  ["past", "Datas anteriores"],
] as const;
export function PlanBrowser(props: BrowserProps): ReactElement {
  const [state, setState] = useState<Browse>(() => ({
    history: false,
    filter: props.data.plan?.items.some((item) => item.plannedOn >= props.data.scope.today)
      ? "upcoming"
      : "all",
    search: "",
    page: 1,
  }));
  const update = (patch: Partial<Browse>): void =>
    setState((current) => ({ ...current, ...patch }));
  const controls = { ...props, state, update };
  return (
    <div className={styles.content}>
      <BrowserToolbar {...controls} />
      {!state.history && <BrowserFilters {...controls} />}
      {state.history ? (
        <div className={styles.history}>
          <PlanHistory data={props.data} />
        </div>
      ) : (
        <BrowserTable {...controls} />
      )}
    </div>
  );
}
function BrowserToolbar(props: Controls): ReactElement {
  const { data, state, update, mode } = props;
  const changeView = (view: View): void => {
    props.setView(view);
    update({ page: 1, history: false, search: "" });
  };
  return (
    <div className={styles.toolbar}>
      <div className={styles.heading}>
        {state.history ? (
          <>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Voltar ao roteiro"
              onClick={() => update({ history: false })}
            >
              <ArrowLeft />
            </Button>
            <h3>Versões do plano</h3>
            <span>Versão atual {data.plan?.version}</span>
          </>
        ) : (
          <ViewSwitch data={data} view={props.view} changeView={changeView} />
        )}
      </div>
      {!state.history && (
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" onClick={() => update({ history: true })}>
            <History />
            Versões
          </Button>
          {!data.scope.readOnly && props.view === "plan" && (
            <Button size="sm" onClick={() => mode({ kind: "item", item: null })}>
              <Plus />
              Adicionar atividade
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
function BrowserFilters({ view, state, update }: Controls): ReactElement {
  return (
    <div className={styles.filters}>
      {view === "plan" && (
        <div className={styles.actions} role="group" aria-label="Período do roteiro">
          {FILTERS.map(([value, label]) => (
            <Button
              key={value}
              variant={state.filter === value ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={state.filter === value}
              onClick={() => update({ filter: value, page: 1 })}
            >
              <CalendarDays aria-hidden />
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
        value={state.search}
        onChange={(event) => update({ search: event.target.value, page: 1 })}
      />
    </div>
  );
}
function includesDate(date: string, { today, filter }: { today: string; filter: Filter }): boolean {
  if (filter === "all") return true;
  return filter === "upcoming" ? date >= today : date < today;
}
function filteredRows(
  data: Planning,
  state: Browse,
): { items: NonNullable<Planning["plan"]>["items"]; records: Planning["records"] } {
  const needle = state.search.trim().toLocaleLowerCase("pt-BR");
  const items = (data.plan?.items ?? []).filter(
    (item) =>
      includesDate(item.plannedOn, { today: data.scope.today, filter: state.filter }) &&
      `${item.title} ${item.reference ?? ""} ${dateLabel(item.plannedOn)}`
        .toLocaleLowerCase("pt-BR")
        .includes(needle),
  );
  const records = data.records.filter((row) =>
    `${row.content.account} ${row.content.reference ?? ""} ${dateLabel(row.date)}`
      .toLocaleLowerCase("pt-BR")
      .includes(needle),
  );
  return { items, records };
}
function BrowserTable({ data, state, update, view, mode }: Controls): ReactElement {
  const { items, records } = filteredRows(data, state);
  const count = view === "plan" ? items.length : records.length;
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const page = Math.min(state.page, pageCount);
  const offset = (page - 1) * PAGE_SIZE;
  const pagination: TablePaginationConfig = {
    page,
    pageSize: PAGE_SIZE,
    pageCount,
    totalItems: count,
    onPageChange: (next) => update({ page: next }),
  };
  return (
    <div className={styles.table}>
      {view === "records" ? (
        <PlanningRecords
          data={data}
          records={records.slice(offset, offset + PAGE_SIZE)}
          pagination={pagination}
        />
      ) : (
        <PlanTable
          items={items.slice(offset, offset + PAGE_SIZE)}
          pagination={pagination}
          filtered={Boolean(state.search.trim()) || state.filter !== "all"}
          onEdit={data.scope.readOnly ? undefined : (item) => mode({ kind: "item", item })}
        />
      )}
    </div>
  );
}

function ViewSwitch({
  data,
  view,
  changeView,
}: {
  data: Planning;
  view: View;
  changeView: (view: View) => void;
}): ReactElement | null {
  if (!data.plan?.items.length && data.records.length === 0) return null;
  return (
    <div className={styles.viewSwitch} role="group" aria-label="Visão do planejamento">
      <Button
        size="sm"
        variant={view === "plan" ? "secondary" : "ghost"}
        aria-pressed={view === "plan"}
        onClick={() => changeView("plan")}
      >
        <BookOpen aria-hidden />
        Roteiro · {data.plan?.items.length ?? 0}
      </Button>
      <Button
        size="sm"
        variant={view === "records" ? "secondary" : "ghost"}
        aria-pressed={view === "records"}
        onClick={() => changeView("records")}
      >
        <FileText aria-hidden />
        Aulas registradas · {data.records.length}
      </Button>
    </div>
  );
}
