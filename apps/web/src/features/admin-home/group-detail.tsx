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
  const query = trpc.dashboard.pending.useQuery(
    { kind: group.kind, page },
    { refetchInterval: 60_000 },
  );
  return (
    <>
      <Button variant="ghost" size="sm" onClick={close}>
        <ArrowLeft aria-hidden="true" />
        Todas as pendências
      </Button>
      <div className={styles.detailHeading}>
        <h2 id="home-work-title">{group.title}</h2>
        <p>{group.description}</p>
      </div>
      <div className={styles.table}>
        <DataTable
          label={group.title}
          columns={groupColumns(open)}
          state={tableState(query)}
          onRetry={() => void query.refetch()}
          errorTitle="Não foi possível carregar as pendências"
          empty={{
            title: "Nenhuma pendência nesta página",
            description:
              page > 1
                ? "Os registros mudaram. Volte à primeira página para conferir."
                : "Este grupo está em dia. Continue pelos próximos passos.",
          }}
        />
      </div>
      <GroupPagination query={query} page={page} setPage={setPage} />
    </>
  );
}
function tableState(query: PendingQuery): DataTableState<HomeItem> {
  if (query.isPending) return { kind: "loading" };
  if (query.isError) return { kind: "error" };
  return { kind: "data", rows: query.data?.items ?? [] };
}
function groupColumns(open: OpenAction): DataTableColumn<HomeItem>[] {
  return [
    {
      id: "subject",
      header: "Acompanhar",
      cell: (item) => (
        <div className={styles.itemText}>
          <strong>{item.title}</strong>
          <span>{item.detail}</span>
        </div>
      ),
    },
    { id: "date", header: "Data", cell: (item) => <ItemDate item={item} /> },
    {
      id: "action",
      header: "",
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
function GroupPagination({
  query,
  page,
  setPage,
}: {
  query: PendingQuery;
  page: number;
  setPage: (page: number) => void;
}): ReactElement {
  const pages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));
  return (
    <div className={styles.pagination}>
      <span>
        {query.data
          ? `${query.data.total} ações · página ${page} de ${pages}`
          : "Carregando ações…"}
      </span>
      <div>
        <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(1)}>
          Primeira
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Anterior
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={query.isPending || page >= pages}
          onClick={() => setPage(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}
