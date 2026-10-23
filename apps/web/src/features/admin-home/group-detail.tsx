import { useState, type ReactElement } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Button, DataTable, type DataTableColumn, type DataTableState } from "@lazuli/ui";
import { trpc, type QueryResult } from "~/lib/trpc";
import { ItemDate, type HomeGroup, type HomeItem, type OpenAction } from "./home-parts";
import styles from "./home.module.css";
const PAGE_SIZE = 12;
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
        <div className={styles.periodSwitch} role="group" aria-label="Período dos registros">
          <Button variant={period === "recent" ? "secondary" : "ghost"} size="sm" aria-pressed={period === "recent"} onClick={() => { setPeriod("recent"); setPage(1); }}>Últimos 7 dias</Button>
          <Button variant={period === "history" ? "secondary" : "ghost"} size="sm" aria-pressed={period === "history"} onClick={() => { setPeriod("history"); setPage(1); }}>Histórico anterior</Button>
        </div>
      )}
      <div className={styles.table}>
        <DataTable
          label={group.title}
          columns={groupColumns(group, open)}
          state={tableState(query)}
          loadingRows={Math.min(PAGE_SIZE, (period === "history" ? group.historyTotal : group.total) || 4)}
          onRowClick={item => open(item.action)}
          pagination={{
            page,
            pageSize: PAGE_SIZE,
            onPageChange: setPage,
            itemLabel: { singular: "ação", plural: "ações" },
            ...(query.isPending
              ? { loading: true }
              : {
                  pageCount: Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE)),
                  totalItems: query.data?.total ?? 0,
                }),
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
      </div>
    </>
  );
}
function tableState(query: PendingQuery): DataTableState<HomeItem> {
  if (query.isPending) return { kind: "loading" };
  if (query.isError) return { kind: "error" };
  const rows = query.data?.items ?? [];
  return rows.length > 0 ? { kind: "data", rows } : { kind: "empty" };
}
function groupColumns(group: HomeGroup, open: OpenAction): DataTableColumn<HomeItem>[] {
  const dates: DataTableColumn<HomeItem>[] = ["students", "contracts", "allocation"].includes(
    group.kind,
  )
    ? []
    : [{ id: "date", header: "Data", width: "narrow", cell: (item) => <ItemDate item={item} /> }];
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
