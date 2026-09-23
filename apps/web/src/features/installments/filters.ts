import {
  FINANCE_OVERDUE_PAYERS_PAGE_SIZE,
  civilDateSchema,
  type FinanceInstallmentsInput,
} from "@lazuli/validators";

export const SEARCH_MAX_LENGTH = 80;
const CENTS_PER_REAL = 100;
export const INSTALLMENT_STATUSES = [
  "OVERDUE",
  "DUE_THIS_MONTH",
  "UPCOMING",
  "PAID",
  "WAIVED",
] as const;
type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export type InstallmentParams = {
  status: string | null;
  search: string | null;
  situations: string | null;
  dueFrom: string | null;
  dueTo: string | null;
  amountFrom: string | null;
  amountTo: string | null;
};

export type InstallmentFilterPatch = Partial<
  Pick<InstallmentParams, "status" | "situations" | "dueFrom" | "dueTo" | "amountFrom" | "amountTo">
>;

export type InstallmentFilters = {
  status: "vencidas" | null;
  search: string;
  situations: InstallmentStatus[];
  dueFrom: string;
  dueTo: string;
  amountFrom: string;
  amountTo: string;
  page: number;
  pageSize: FinanceInstallmentsInput["pageSize"];
};

function validStatuses(value: string | null): InstallmentStatus[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .filter((status): status is InstallmentStatus =>
          INSTALLMENT_STATUSES.includes(status as InstallmentStatus),
        ),
    ),
  ];
}

export function normalizeFilters(
  params: InstallmentParams,
  pagination: Pick<InstallmentFilters, "page" | "pageSize">,
): InstallmentFilters {
  const situations = validStatuses(params.situations);
  const dueFrom = validDate(params.dueFrom);
  const dueTo = validDate(params.dueTo);
  const amountFrom = validAmount(params.amountFrom);
  const amountTo = validAmount(params.amountTo);
  return {
    status: params.status === "vencidas" ? "vencidas" : null,
    search: (params.search ?? "").slice(0, SEARCH_MAX_LENGTH),
    situations: normalizedSituations(params.status, situations),
    dueFrom: dueFrom && dueTo && dueFrom > dueTo ? "" : dueFrom,
    dueTo: dueFrom && dueTo && dueFrom > dueTo ? "" : dueTo,
    amountFrom: amountFrom && amountTo && Number(amountFrom) > Number(amountTo) ? "" : amountFrom,
    amountTo: amountFrom && amountTo && Number(amountFrom) > Number(amountTo) ? "" : amountTo,
    ...pagination,
  };
}

function validDate(value: string | null): string {
  return value && civilDateSchema.safeParse(value).success ? value : "";
}

function validAmount(value: string | null): string {
  return value && validCents(value) !== undefined ? value : "";
}

function normalizedSituations(
  status: string | null,
  situations: InstallmentStatus[],
): InstallmentStatus[] {
  if (status === "vencidas") return [];
  if (status === "pagas" && situations.length === 0) return ["PAID"];
  return situations;
}

export function searchPatch(value: string): Pick<InstallmentParams, "search"> {
  return { search: value.slice(0, SEARCH_MAX_LENGTH) || null };
}

export function situationPatch(values: string[]): Pick<InstallmentParams, "status" | "situations"> {
  if (values.length === 1 && values[0] === "OVERDUE") {
    return { status: "vencidas", situations: null };
  }
  return { status: null, situations: values.join(",") || null };
}

function validCents(value: string): number | undefined {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/u.test(value)) return undefined;
  const cents = Math.round(Number(value) * CENTS_PER_REAL);
  return Number.isSafeInteger(cents) ? cents : undefined;
}

function dueRangeInput(
  filters: InstallmentFilters,
): Pick<FinanceInstallmentsInput, "dueFrom" | "dueTo"> {
  const dueFrom = filters.dueFrom || undefined;
  const dueTo = filters.dueTo || undefined;
  if (dueFrom && dueTo && dueFrom > dueTo) return {};
  return { ...(dueFrom ? { dueFrom } : {}), ...(dueTo ? { dueTo } : {}) };
}

function amountRangeInput(
  filters: InstallmentFilters,
): Pick<FinanceInstallmentsInput, "amountFromCents" | "amountToCents"> {
  const amountFromCents = validCents(filters.amountFrom);
  const amountToCents = validCents(filters.amountTo);
  if (
    amountFromCents !== undefined &&
    amountToCents !== undefined &&
    amountFromCents > amountToCents
  )
    return {};
  return {
    ...(amountFromCents === undefined ? {} : { amountFromCents }),
    ...(amountToCents === undefined ? {} : { amountToCents }),
  };
}

export function queryInput(filters: InstallmentFilters): FinanceInstallmentsInput {
  return {
    view: filters.status === "vencidas" ? "overdue" : "all",
    page: filters.page,
    pageSize: filters.status === "vencidas" ? FINANCE_OVERDUE_PAYERS_PAGE_SIZE : filters.pageSize,
    search: filters.search.trim(),
    ...(filters.situations.length > 0 ? { statuses: filters.situations } : {}),
    ...dueRangeInput(filters),
    ...amountRangeInput(filters),
  };
}
