"use client";

import { useCallback, useEffect } from "react";
import { parseAsString, useQueryStates } from "nuqs";
import type { FinanceInstallmentsOutput } from "@lazuli/validators";
import { trpc, type QueryResult } from "~/lib/trpc";
import { normalizeFilters, queryInput, searchPatch, statusPatch, validPage } from "./filters";

const parsers = { status: parseAsString, busca: parseAsString, pagina: parseAsString };
type InstallmentsState = {
  filters: ReturnType<typeof normalizeFilters>;
  data: Extract<FinanceInstallmentsOutput, { view: "all" | "paid" }> | undefined;
  query: QueryResult<FinanceInstallmentsOutput>;
  setPage: (page: number) => void;
  setSearch: (value: string) => void;
  setStatus: (value: string) => void;
};
export function useInstallments(): InstallmentsState {
  const [params, setParams] = useQueryStates(parsers);
  const filters = normalizeFilters(params);
  const input = queryInput(filters);
  useNormalizeUrl(params, setParams);
  const query = useList(input);
  const data = query.data?.view === input.view ? query.data : undefined;
  const setPage = useCallback(
    (page: number) => {
      void setParams({ pagina: page <= 1 ? null : String(page) });
    },
    [setParams],
  );
  useEffect(() => {
    if (data !== undefined && !query.isPlaceholderData && !query.isFetching) {
      const page = validPage(filters.pagina, data.pageCount);
      if (page !== filters.pagina) setPage(page);
    }
  }, [data, query.isPlaceholderData, query.isFetching, filters.pagina, setPage]);
  const setSearch = useCallback(
    (value: string) => {
      void setParams(searchPatch(value));
    },
    [setParams],
  );
  return {
    filters,
    data,
    query,
    setPage,
    setSearch,
    setStatus: (value: string) => {
      void setParams(statusPatch(value));
    },
  };
}

function useNormalizeUrl(
  params: Parameters<typeof normalizeFilters>[0],
  setParams: ReturnType<typeof useQueryStates<typeof parsers>>[1],
): void {
  const filters = normalizeFilters(params);
  useEffect(() => {
    const normalized = {
      status: filters.status,
      busca: filters.busca || null,
      pagina: filters.pagina === 1 ? null : String(filters.pagina),
    };
    if (
      params.status !== normalized.status ||
      params.busca !== normalized.busca ||
      params.pagina !== normalized.pagina
    ) {
      void setParams(normalized);
    }
  }, [params, setParams, filters.status, filters.busca, filters.pagina]);
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
