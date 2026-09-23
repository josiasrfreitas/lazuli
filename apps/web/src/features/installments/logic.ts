"use client";

import { useCallback, useEffect } from "react";
import { parseAsString, useQueryStates } from "nuqs";
import {
  financeInstallmentsPaginationPolicy,
  type FinanceInstallmentsOutput,
} from "@lazuli/validators";
import { trpc, type QueryResult } from "~/lib/trpc";
import { pageWithinRange, useUrlPagination } from "~/lib/pagination";
import { normalizeFilters, queryInput, searchPatch, type InstallmentFilterPatch } from "./filters";

const parsers = {
  status: parseAsString,
  busca: parseAsString,
  situacoes: parseAsString,
  vencimentoDe: parseAsString,
  vencimentoAte: parseAsString,
  valorDe: parseAsString,
  valorAte: parseAsString,
};
type InstallmentUrlParams = Record<keyof typeof parsers, string | null>;

function filtersFromUrl(
  params: InstallmentUrlParams,
  pagination: Pick<ReturnType<typeof normalizeFilters>, "page" | "pageSize">,
): ReturnType<typeof normalizeFilters> {
  return normalizeFilters(
    {
      status: params.status,
      search: params.busca,
      situations: params.situacoes,
      dueFrom: params.vencimentoDe,
      dueTo: params.vencimentoAte,
      amountFrom: params.valorDe,
      amountTo: params.valorAte,
    },
    pagination,
  );
}
type InstallmentsState = {
  filters: ReturnType<typeof normalizeFilters>;
  data: FinanceInstallmentsOutput | undefined;
  query: QueryResult<FinanceInstallmentsOutput>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSearch: (value: string) => void;
  setFilters: (patch: InstallmentFilterPatch) => void;
};

type InstallmentsQueryScope = Pick<
  ReturnType<typeof queryInput>,
  "search" | "view" | "statuses" | "dueFrom" | "dueTo" | "amountFromCents" | "amountToCents"
>;

export function urlParamsForFilterPatch(patch: InstallmentFilterPatch): Partial<{
  status: string | null;
  situacoes: string | null;
  vencimentoDe: string | null;
  vencimentoAte: string | null;
  valorDe: string | null;
  valorAte: string | null;
}> {
  const params: ReturnType<typeof urlParamsForFilterPatch> = {};
  if (patch.status !== undefined) params.status = patch.status;
  if (patch.situations !== undefined) params.situacoes = patch.situations;
  if (patch.dueFrom !== undefined) params.vencimentoDe = patch.dueFrom;
  if (patch.dueTo !== undefined) params.vencimentoAte = patch.dueTo;
  if (patch.amountFrom !== undefined) params.valorDe = patch.amountFrom;
  if (patch.amountTo !== undefined) params.valorAte = patch.amountTo;
  return params;
}

export function sameInstallmentsQueryScope(
  previous: InstallmentsQueryScope | undefined,
  current: InstallmentsQueryScope,
): boolean {
  return (
    previous !== undefined &&
    previous.search === current.search &&
    previous.view === current.view &&
    JSON.stringify(previous.statuses ?? []) === JSON.stringify(current.statuses ?? []) &&
    previous.dueFrom === current.dueFrom &&
    previous.dueTo === current.dueTo &&
    previous.amountFromCents === current.amountFromCents &&
    previous.amountToCents === current.amountToCents
  );
}

export function effectivePageCorrection({
  page,
  pageCount,
  placeholder,
  fetching,
}: {
  page: number;
  pageCount: number;
  placeholder: boolean;
  fetching: boolean;
}): number | null {
  if (placeholder || fetching) return null;
  const corrected = pageWithinRange(page, pageCount);
  return corrected === page ? null : corrected;
}

export function useInstallments(): InstallmentsState {
  const [params, setParams] = useQueryStates(parsers);
  const pagination = useUrlPagination(financeInstallmentsPaginationPolicy);
  const filters = filtersFromUrl(params, pagination);
  const input = queryInput(filters);
  const query = useList(input);
  const data = query.data?.view === input.view ? query.data : undefined;
  const setPage = pagination.setPage;
  useEffect(() => {
    if (params.status !== "pagas") return;
    void setParams({ status: null, situacoes: params.situacoes ?? "PAID" });
  }, [params.status, params.situacoes, setParams]);
  useEffect(() => {
    if (data === undefined) return;
    const page = effectivePageCorrection({
      page: filters.page,
      pageCount: data.pageCount,
      placeholder: query.isPlaceholderData,
      fetching: query.isFetching,
    });
    if (page !== null) setPage(page);
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
    setFilters: (patch) => {
      void setParams(urlParamsForFilterPatch(patch));
      setPage(1);
    },
  };
}

function useList(input: ReturnType<typeof queryInput>): QueryResult<FinanceInstallmentsOutput> {
  return trpc.finance.installments.useQuery(input, {
    placeholderData: (previous, previousQuery) => {
      const key = (
        previousQuery?.queryKey as
          | readonly [readonly string[], { input?: InstallmentsQueryScope }]
          | undefined
      )?.[1];
      return sameInstallmentsQueryScope(key?.input, input) ? previous : undefined;
    },
  });
}
