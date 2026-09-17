import {
  FINANCE_OVERDUE_PAYERS_PAGE_SIZE,
  type FinanceInstallmentsInput,
} from "@lazuli/validators";

export const SEARCH_MAX_LENGTH = 80;
export type InstallmentParams = {
  status: string | null;
  search: string | null;
};

export type InstallmentFilters = {
  status: "pagas" | "vencidas" | null;
  search: string;
  page: number;
  pageSize: FinanceInstallmentsInput["pageSize"];
};

export function normalizeFilters(
  params: InstallmentParams,
  pagination: Pick<InstallmentFilters, "page" | "pageSize">,
): InstallmentFilters {
  return {
    status: params.status === "pagas" || params.status === "vencidas" ? params.status : null,
    search: (params.search ?? "").slice(0, SEARCH_MAX_LENGTH),
    ...pagination,
  };
}
export function searchPatch(value: string): Pick<InstallmentParams, "search"> {
  return { search: value.slice(0, SEARCH_MAX_LENGTH) || null };
}
export function statusPatch(value: string): Pick<InstallmentParams, "status"> {
  return { status: value === "pagas" || value === "vencidas" ? value : null };
}

function viewForStatus(status: InstallmentFilters["status"]): FinanceInstallmentsInput["view"] {
  if (status === "pagas") return "paid";
  if (status === "vencidas") return "overdue";
  return "all";
}

export function queryInput(filters: InstallmentFilters): FinanceInstallmentsInput {
  return {
    view: viewForStatus(filters.status),
    page: filters.page,
    pageSize: filters.status === "vencidas" ? FINANCE_OVERDUE_PAYERS_PAGE_SIZE : filters.pageSize,
    search: filters.search.trim(),
  };
}
