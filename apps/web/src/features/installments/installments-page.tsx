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
import { PaymentEntry } from "./payment/payment-entry";

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
    filters.origins.length > 0 ||
    filters.dueFrom ||
    filters.dueTo ||
    filters.amountFrom ||
    filters.amountTo,
  );
}

export function InstallmentsPage(): ReactElement {
  const { filters, data, query, setPage, setPageSize, setSearch, setFilters } = useInstallments();
  const visible =
    data?.view === "overdue" ? data.groups.flatMap((group) => group.rows) : (data?.rows ?? []);
  return (
    <PaymentEntry visible={visible}>
      {({ action, toolbar }) => (
        <DataTablePage
          title="Recebíveis"
          controls={
            <div className="flex flex-wrap items-center gap-2">
              <InstallmentsControls
                search={filters.search}
                filters={filters}
                onSearch={setSearch}
                onFilters={setFilters}
              />
              {action}
            </div>
          }
        >
          <InstallmentsTable
            rows={data?.view === "all" || data?.view === "paid" ? data.rows : undefined}
            groups={data?.view === "overdue" ? data.groups : undefined}
            error={query.isError}
            filtered={hasInstallmentFilters(filters)}
            showOverdueSearchGuidance={
              filters.status === "vencidas" && filters.search.trim() !== ""
            }
            updating={query.isFetching}
            onRetry={() => {
              void query.refetch();
            }}
            footer={
              <>
                <p role="status" className="sr-only">
                  {query.isFetching ? "Atualizando recebíveis" : ""}
                </p>
                {toolbar && <div className="shrink-0 p-2">{toolbar}</div>}
                <InstallmentsPagination {...{ data, filters, setPage, setPageSize }} />
              </>
            }
          />
        </DataTablePage>
      )}
    </PaymentEntry>
  );
}
