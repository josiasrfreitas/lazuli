import type { FinanceInstallmentsInput } from "@lazuli/validators";

export const SEARCH_MAX_LENGTH = 80;
export type InstallmentParams = {
  status: string | null;
  busca: string | null;
  pagina: string | null;
};

export type InstallmentFilters = { status: "pagas" | null; busca: string; pagina: number };

export function normalizeFilters(params: InstallmentParams): InstallmentFilters {
  const number = Number(params.pagina);
  return {
    status: params.status === "pagas" ? "pagas" : null,
    busca: (params.busca ?? "").slice(0, SEARCH_MAX_LENGTH),
    pagina:
      params.status === "vencidas" || !Number.isSafeInteger(number) || number < 1 ? 1 : number,
  };
}
export function searchPatch(value: string): Pick<InstallmentParams, "busca" | "pagina"> {
  return { busca: value.slice(0, SEARCH_MAX_LENGTH) || null, pagina: null };
}
export function statusPatch(value: string): Pick<InstallmentParams, "status" | "pagina"> {
  return { status: value === "pagas" ? "pagas" : null, pagina: null };
}
export function queryInput(
  filters: InstallmentFilters,
): FinanceInstallmentsInput & { view: "all" | "paid" } {
  return {
    view: filters.status === "pagas" ? "paid" : "all",
    page: filters.pagina,
    search: filters.busca.trim(),
  };
}
export function validPage(page: number, pageCount: number): number {
  return Math.min(page, Math.max(1, pageCount));
}
