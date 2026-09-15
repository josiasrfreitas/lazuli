"use client";

import { useCallback, useEffect } from "react";
import { parseAsString, useQueryStates } from "nuqs";
import {
  financeInstallmentsPaginationPolicy,
  type FinanceInstallmentsOutput,
} from "@lazuli/validators";
import { trpc, type QueryResult } from "~/lib/trpc";
import { pageWithinRange, useUrlPagination } from "~/lib/pagination";
import { normalizeFilters, queryInput, searchPatch, statusPatch } from "./filters";

const parsers = {
  status: parseAsString,
  busca: parseAsString,
};
type InstallmentsState = {
  filters: ReturnType<typeof normalizeFilters>;
  data: Extract<FinanceInstallmentsOutput, { view: "all" | "paid" }> | undefined;
  query: QueryResult<FinanceInstallmentsOutput>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSearch: (value: string) => void;
  setStatus: (value: string) => void;
};
export function useInstallments(): InstallmentsState {
  const [params, setParams] = useQueryStates(parsers);
  const pagination = useUrlPagination(financeInstallmentsPaginationPolicy);
  const filters = normalizeFilters(
    { status: params.status, search: params.busca },
    {
      page: pagination.page,
      pageSize: pagination.pageSize,
    },
  );
  const input = queryInput(filters);
  const query = useList(input);
  const data = query.data?.view === input.view ? query.data : undefined;
  const setPage = pagination.setPage;
  useEffect(() => {
    if (data !== undefined && !query.isPlaceholderData && !query.isFetching) {
      const page = pageWithinRange(filters.page, data.pageCount);
      if (page !== filters.page) setPage(page);
    }
  }, [data, query.isPlaceholderData, query.isFetching, filters.page, setPage]);
  const setSearch = useCallback(
    (value: string) => {
      void setParams({ busca: searchPatch(value).search });
      setPage(1);
    },
    [setPage, setParams],
  );
  return {
    filters,
    data,
    query,
    setPage,
    setPageSize: pagination.setPageSize,
    setSearch,
    setStatus: (value: string) => {
      void setParams(statusPatch(value));
      setPage(1);
    },
  };
}

function useList(input: ReturnType<typeof queryInput>): QueryResult<FinanceInstallmentsOutput> {
  return trpc.finance.installments.useQuery(input, {
    placeholderData: (previous, previousQuery) => {
      const key = (
        previousQuery?.queryKey as
          | readonly [readonly string[], { input?: { search?: string; view?: string } }]
          | undefined
      )?.[1];
      return key?.input?.search === input.search && key?.input?.view === input.view
        ? previous
        : undefined;
    },
  });
}
