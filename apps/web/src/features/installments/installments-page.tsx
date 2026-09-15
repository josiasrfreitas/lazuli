"use client";

import type { ReactElement } from "react";

import { DataTablePage, TablePagination } from "@lazuli/ui";
import { FINANCE_INSTALLMENTS_PAGE_SIZE } from "@lazuli/validators";
import { InstallmentsControls } from "./installments-controls";
import { InstallmentsTable } from "./installments-table";
import { useInstallments } from "./logic";

export function InstallmentsPage(): ReactElement {
  const { filters, data, query, setPage, setSearch, setStatus } = useInstallments();
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
          search={filters.busca}
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
        filtered={filters.busca !== "" || filters.status !== null}
        updating={query.isFetching}
        onRetry={() => {
          void query.refetch();
        }}
        footer={
          <>
            <p role="status" className="sr-only">
              {query.isFetching ? "Atualizando parcelas" : ""}
            </p>
            <TablePagination
              itemLabel={{ singular: "parcela", plural: "parcelas" }}
              page={data?.page ?? filters.pagina}
              pageSize={FINANCE_INSTALLMENTS_PAGE_SIZE}
              onPageChange={setPage}
              {...(data === undefined
                ? { loading: true }
                : { pageCount: data.pageCount, totalItems: data.total })}
            />
          </>
        }
      />
    </DataTablePage>
  );
}
