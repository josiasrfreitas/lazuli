"use client";

import type { ReactElement } from "react";
import { DataTable, type DataTableState } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { contractColumns, type ContractRow } from "./contract-columns";

const PAGE_SIZE = 20;

function tableState({
  rows,
  failed,
  filtered,
}: {
  rows: ContractRow[] | undefined;
  failed: boolean;
  filtered: boolean;
}): DataTableState<ContractRow> {
  if (failed) return { kind: "error" };
  if (rows === undefined) return { kind: "loading" };
  if (rows.length === 0) return { kind: filtered ? "noResults" : "empty" };
  return { kind: "data", rows };
}

export function ContractsTable({
  page,
  query,
  onPageChange,
}: {
  page: number;
  query: string;
  onPageChange: (page: number) => void;
}): ReactElement {
  const list = trpc.finance.listContracts.useQuery({ page, query });
  return (
    <DataTable
      label="Contratos mensais"
      columns={contractColumns}
      state={tableState({
        rows: list.data?.rows,
        failed: list.isError,
        filtered: query.trim() !== "",
      })}
      errorTitle="Não foi possível carregar os contratos"
      empty={{
        title: "Nenhum contrato cadastrado",
        description: "Crie o primeiro contrato para começar.",
      }}
      onRetry={() => void list.refetch()}
      pagination={{
        page,
        pageSize: PAGE_SIZE,
        onPageChange,
        itemLabel: { singular: "contrato", plural: "contratos" },
        ...(list.data
          ? {
              pageCount: Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)),
              totalItems: list.data.total,
            }
          : { loading: true }),
      }}
    />
  );
}
