"use client";

import type { ReactElement } from "react";

import { DataTablePage, TablePagination } from "@lazuli/ui";
import {
  financeInstallmentsPaginationPolicy,
  financeOverduePaginationPolicy,
} from "@lazuli/validators";
import { tablePaginationPropsFor } from "~/lib/pagination";
import { InstallmentsControls } from "./installments-controls";
import type { InstallmentFilters } from "./filters";
import { InstallmentsTable } from "./installments-table";
import { useInstallments } from "./logic";

export function InstallmentsPagination({
  data,
  filters,
  setPage,
  setPageSize,
}: Pick<ReturnType<typeof useInstallments>, "data" | "setPage" | "setPageSize"> & {
  filters: Pick<InstallmentFilters, "status" | "page" | "pageSize">;
}): ReactElement {
  const overdue = filters.status === "vencidas";
  return (
    <TablePagination
      className={overdue ? "bg-transparent" : undefined}
      itemLabel={
        overdue
          ? { singular: "pagador", plural: "pagadores" }
          : { singular: "parcela", plural: "parcelas" }
      }
      {...tablePaginationPropsFor(
        {
          page: filters.page,
          pageSize: overdue ? financeOverduePaginationPolicy.defaultPageSize : filters.pageSize,
          ...(overdue
            ? {}
            : { pageSizeOptions: financeInstallmentsPaginationPolicy.pageSizeOptions }),
          setPage,
          setPageSize,
        },
        data,
      )}
    />
  );
}

function hasInstallmentFilters(filters: InstallmentFilters): boolean {
  return Boolean(
    filters.search ||
    filters.status ||
    filters.situations.length > 0 ||
    filters.dueFrom ||
    filters.dueTo ||
    filters.amountFrom ||
    filters.amountTo,
  );
}

export function InstallmentsPage(): ReactElement {
  const { filters, data, query, setPage, setPageSize, setSearch, setFilters } = useInstallments();
  return (
    <DataTablePage
      header={
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-display text-2xl font-semibold text-foreground">Recebíveis</h1>
          <p className="text-sm text-muted-foreground">Vencimentos e pagamentos</p>
        </div>
      }
      controls={
        <InstallmentsControls
          search={filters.search}
          filters={filters}
          onSearch={setSearch}
          onFilters={setFilters}
        />
      }
    >
      <InstallmentsTable
        rows={data?.view === "all" || data?.view === "paid" ? data.rows : undefined}
        groups={data?.view === "overdue" ? data.groups : undefined}
        error={query.isError}
        filtered={hasInstallmentFilters(filters)}
        showOverdueSearchGuidance={filters.status === "vencidas" && filters.search.trim() !== ""}
        updating={query.isFetching}
        onRetry={() => {
          void query.refetch();
        }}
        footer={
          <>
            <p role="status" className="sr-only">
              {query.isFetching ? "Atualizando recebíveis" : ""}
            </p>
            <InstallmentsPagination {...{ data, filters, setPage, setPageSize }} />
          </>
        }
      />
    </DataTablePage>
  );
}
