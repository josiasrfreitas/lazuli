import { useState, type ReactElement } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Button, DataTable, type DataTableColumn, type DataTableState } from "@lazuli/ui";
import { trpc, type QueryResult } from "~/lib/trpc";
import { ItemDate, type HomeGroup, type HomeItem, type OpenAction } from "./home-parts";
import styles from "./home.module.css";
const PAGE_SIZE = 12;
const MIN_LOADING_ROWS = 4;
type PendingQuery = QueryResult<HomeGroup>;
export function GroupDetail({
  group,
  close,
  open,
}: {
  group: HomeGroup;
  close: () => void;
  open: OpenAction;
}): ReactElement {
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState(group.period ?? "all");
  const query = trpc.dashboard.pending.useQuery(
    { kind: group.kind, page, period },
    { refetchInterval: 60_000 },
  );
  const choosePeriod = (next: "recent" | "history"): void => {
    setPeriod(next);
    setPage(1);
  };
  return (
    <>
      <Button variant="ghost" size="sm" onClick={close}>
        <ArrowLeft aria-hidden="true" />
        Voltar à visão da escola
      </Button>
      <div className={styles.detailHeading}>
        <h1 id="home-work-title">{group.title}</h1>
        <p>{group.description}</p>
      </div>
      {(group.kind === "lessons" || group.kind === "appointments") && (
        <PeriodSwitch period={period} choose={choosePeriod} />
      )}
      <div className={styles.table}>
        <PendingTable
          group={group}
          query={query}
          page={page}
          setPage={setPage}
          period={period}
          open={open}
        />
      </div>
    </>
  );
}
function PeriodSwitch({
  period,
  choose,
}: {
  period: string;
  choose: (period: "recent" | "history") => void;
}): ReactElement {
  return (
    <div className={styles.periodSwitch} role="group" aria-label="Período dos registros">
      <Button
        variant={period === "recent" ? "secondary" : "ghost"}
        size="sm"
        aria-pressed={period === "recent"}
        onClick={() => choose("recent")}
      >
        Últimos 7 dias
      </Button>
      <Button
        variant={period === "history" ? "secondary" : "ghost"}
        size="sm"
        aria-pressed={period === "history"}
        onClick={() => choose("history")}
      >
        Histórico anterior
      </Button>
    </div>
  );
}
function PendingTable({
  group,
  query,
  page,
  setPage,
  period,
  open,
}: {
  group: HomeGroup;
  query: PendingQuery;
  page: number;
  setPage: (page: number) => void;
  period: string;
  open: OpenAction;
}): ReactElement {
  const pageCount = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));
  const loadingRows = Math.min(
    PAGE_SIZE,
    (period === "history" ? group.historyTotal : group.total) || MIN_LOADING_ROWS,
  );
  return (
    <DataTable
      label={group.title}
      columns={groupColumns(group, open)}
      state={tableState(query)}
      loadingRows={loadingRows}
      onRowClick={(item) => open(item.action)}
      pagination={{
        page,
        pageSize: PAGE_SIZE,
        onPageChange: setPage,
        itemLabel: { singular: "ação", plural: "ações" },
        ...(query.isPending
          ? { loading: true }
          : { pageCount, totalItems: query.data?.total ?? 0 }),
      }}
      onRetry={() => void query.refetch()}
      errorTitle="Não foi possível carregar as pendências"
      empty={{
        title: "Nenhuma pendência nesta página",
        description:
          page > 1
            ? "Os registros mudaram. Volte uma página para conferir."
            : "Este grupo está em dia. Continue pelos próximos passos.",
      }}
    />
  );
}
function tableState(query: PendingQuery): DataTableState<HomeItem> {
  if (query.isPending) return { kind: "loading" };
  if (query.isError) return { kind: "error" };
  const rows = query.data?.items ?? [];
  return rows.length > 0 ? { kind: "data", rows } : { kind: "empty" };
}
function groupColumns(group: HomeGroup, open: OpenAction): DataTableColumn<HomeItem>[] {
  const dateLabel = dateColumnLabel(group.kind);
  const dates: DataTableColumn<HomeItem>[] = ["students", "contracts"].includes(group.kind)
    ? []
    : [
        {
          id: "date",
          header: dateLabel,
          width: "narrow",
          cell: (item) => <ItemDate item={item} />,
        },
      ];
  return [
    {
      id: "subject",
      header: "Acompanhar",
      width: "wide",
      cell: (item) => (
        <div className={styles.itemText}>
          <strong>{item.title}</strong>
          <span>{item.detail}</span>
        </div>
      ),
    },
    ...dates,
    {
      id: "action",
      header: "",
      width: "selection",
      cell: (item) => (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Abrir ${item.title}`}
          onClick={() => open(item.action)}
        >
          <ArrowUpRight aria-hidden="true" />
        </Button>
      ),
    },
  ];
}
function dateColumnLabel(kind: HomeGroup["kind"]): string {
  if (kind === "allocation") return "Em espera desde";
  if (kind === "placement") return "Prova recebida";
  if (kind === "semester") return "Entrada prevista";
  return "Data";
}
