"use client";

import { useCallback, useEffect } from "react";
import { parseAsString, useQueryStates } from "nuqs";

import type { TablePaginationProps } from "@lazuli/ui";
import type { PaginationPolicy } from "@lazuli/validators";

type AnyPaginationPolicy = PaginationPolicy<readonly [number, ...number[]]>;
type UrlPaginationParams = { pageParam: string | null; pageSizeParam: string | null };

export type UrlPagination<PageSize extends number = number> = {
  page: number;
  pageSize: PageSize;
  pageSizeOptions?: readonly number[];
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
};

const parsers = { pagina: parseAsString, porPagina: parseAsString };

export function normalizeUrlPagination<const Options extends readonly [number, ...number[]]>(
  policy: PaginationPolicy<Options>,
  params: UrlPaginationParams,
): Pick<UrlPagination<Options[number]>, "page" | "pageSize"> {
  const page = policy.pageSchema.safeParse(Number(params.pageParam));
  const pageSize = policy.pageSizeSchema.safeParse(Number(params.pageSizeParam));

  return {
    page: params.pageParam !== null && page.success ? page.data : 1,
    pageSize:
      params.pageSizeParam !== null && pageSize.success ? pageSize.data : policy.defaultPageSize,
  };
}

export function canonicalPaginationParams(
  policy: AnyPaginationPolicy,
  pagination: Pick<UrlPagination, "page" | "pageSize">,
): UrlPaginationParams {
  return {
    pageParam: pagination.page === 1 ? null : String(pagination.page),
    pageSizeParam:
      pagination.pageSize === policy.defaultPageSize ? null : String(pagination.pageSize),
  };
}

export function pageSizeParams(
  policy: AnyPaginationPolicy,
  pageSize: number,
): UrlPaginationParams | null {
  const parsed = policy.pageSizeSchema.safeParse(pageSize);
  if (!parsed.success) return null;
  return canonicalPaginationParams(policy, { page: 1, pageSize: parsed.data });
}

export function pageWithinRange(page: number, pageCount: number): number {
  return Math.min(page, Math.max(1, pageCount));
}

export function pageSizeOptionsFor(policy: AnyPaginationPolicy): readonly number[] | undefined {
  return policy.pageSizeOptions.length > 1 ? policy.pageSizeOptions : undefined;
}

export function useUrlPagination<const Options extends readonly [number, ...number[]]>(
  policy: PaginationPolicy<Options>,
): UrlPagination<Options[number]> {
  const [params, setParams] = useQueryStates(parsers);
  const rawParams = { pageParam: params.pagina, pageSizeParam: params.porPagina };
  const pagination = normalizeUrlPagination(policy, rawParams);
  const canonical = canonicalPaginationParams(policy, pagination);

  useEffect(() => {
    if (
      rawParams.pageParam !== canonical.pageParam ||
      rawParams.pageSizeParam !== canonical.pageSizeParam
    ) {
      void setParams({ pagina: canonical.pageParam, porPagina: canonical.pageSizeParam });
    }
  }, [
    canonical.pageParam,
    canonical.pageSizeParam,
    rawParams.pageParam,
    rawParams.pageSizeParam,
    setParams,
  ]);

  const setPage = useCallback(
    (page: number) => {
      const parsed = policy.pageSchema.safeParse(page);
      void setParams({ pagina: parsed.success && parsed.data > 1 ? String(parsed.data) : null });
    },
    [policy, setParams],
  );
  const setPageSize = useCallback(
    (pageSize: number) => {
      const patch = pageSizeParams(policy, pageSize);
      if (patch !== null) {
        void setParams({ pagina: patch.pageParam, porPagina: patch.pageSizeParam });
      }
    },
    [policy, setParams],
  );

  return {
    ...pagination,
    ...(pageSizeOptionsFor(policy) === undefined
      ? {}
      : { pageSizeOptions: policy.pageSizeOptions }),
    setPage,
    setPageSize,
  };
}

type PaginationData = { page: number; pageSize: number; pageCount: number; total: number };
type WithoutItemLabel<Props> = Props extends TablePaginationProps
  ? Omit<Props, "itemLabel">
  : never;
export type TablePaginationAdapterProps = WithoutItemLabel<TablePaginationProps>;

export function tablePaginationPropsFor(
  pagination: UrlPagination,
  data: PaginationData | undefined,
): TablePaginationAdapterProps {
  const base = {
    onPageChange: pagination.setPage,
    onPageSizeChange: pagination.setPageSize,
    page: data?.page ?? pagination.page,
    pageSize: data?.pageSize ?? pagination.pageSize,
    ...(pagination.pageSizeOptions === undefined
      ? {}
      : { pageSizeOptions: pagination.pageSizeOptions }),
  };

  return data === undefined
    ? { ...base, loading: true }
    : { ...base, pageCount: data.pageCount, totalItems: data.total };
}
