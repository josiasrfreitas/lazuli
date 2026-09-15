"use client";

import type { ReactElement } from "react";

import { DataTablePage, TablePagination } from "@lazuli/ui";
import { financeInstallmentsPaginationPolicy } from "@lazuli/validators";
import { tablePaginationPropsFor } from "~/lib/pagination";
import { InstallmentsControls } from "./installments-controls";
import { InstallmentsTable } from "./installments-table";
import { useInstallments } from "./logic";

export function InstallmentsPagination({
  data,
  filters,
  setPage,
  setPageSize,
}: Pick<
  ReturnType<typeof useInstallments>,
  "data" | "filters" | "setPage" | "setPageSize"
>): ReactElement {
  return (
    <TablePagination
      itemLabel={{ singular: "parcela", plural: "parcelas" }}
      {...tablePaginationPropsFor(
        {
          page: filters.page,
          pageSize: filters.pageSize,
          pageSizeOptions: financeInstallmentsPaginationPolicy.pageSizeOptions,
          setPage,
          setPageSize,
        },
        data,
      )}
    />
  );
}

export function InstallmentsPage(): ReactElement {
  const { filters, data, query, setPage, setPageSize, setSearch, setStatus } = useInstallments();
  return (
    <DataTablePage
      header={
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-display text-2xl font-semibold text-foreground">Parcelas</h1>
          <p className="text-sm text-muted-foreground">Mensalidades e vencimentos</p>
        </div>
      }
      controls={
        <InstallmentsControls
          search={filters.search}
          status={filters.status}
          counts={data?.counts}
          onSearch={setSearch}
          onStatus={setStatus}
        />
      }
    >
      <InstallmentsTable
        rows={data?.rows}
        error={query.isError}
        filtered={filters.search !== "" || filters.status !== null}
        updating={query.isFetching}
        onRetry={() => {
          void query.refetch();
        }}
        footer={
          <>
            <p role="status" className="sr-only">
              {query.isFetching ? "Atualizando parcelas" : ""}
            </p>
            <InstallmentsPagination {...{ data, filters, setPage, setPageSize }} />
          </>
        }
      />
    </DataTablePage>
  );
}
