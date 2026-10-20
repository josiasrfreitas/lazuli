import { useState } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { FINANCE_INSTALLMENTS_PAGE_SIZE, type FinanceInstallmentRow } from "@lazuli/validators";
import { trpc, type QueryResult } from "~/lib/trpc";

export type FinanceFilter = "all" | "overdue" | "paid";
export type FinanceData = Extract<RouterOutputs["finance"]["installments"], { view: "all" }>;
type Result = RouterOutputs["finance"]["installments"];
export type StudentFinanceState = {
  query: QueryResult<Result>;
  summary: QueryResult<RouterOutputs["finance"]["studentSummary"]>;
  data: FinanceData | undefined;
  page: number;
  setPage: (page: number) => void;
  filter: FinanceFilter;
  setFilter: (value: string | number | null) => void;
  payment: FinanceInstallmentRow | null;
  setPayment: (row: FinanceInstallmentRow | null) => void;
  registered: () => void;
};

export function useStudentFinance(id: string): StudentFinanceState {
  const [page, setPage] = useState(1);
  const [selectedFilter, setFilter] = useState<FinanceFilter | null>(null);
  const [payment, setPayment] = useState<FinanceInstallmentRow | null>(null);
  const utils = trpc.useUtils();
  const summary = trpc.finance.studentSummary.useQuery({ studentId: id }, { staleTime: 0 });
  const filter = selectedFilter ?? (summary.data?.overdueCount === 0 ? "all" : "overdue");
  const query = trpc.finance.installments.useQuery(
    {
      studentId: id,
      view: "all",
      page,
      pageSize: FINANCE_INSTALLMENTS_PAGE_SIZE,
      statuses: filter === "all" ? undefined : [filter === "paid" ? "PAID" : "OVERDUE"],
    },
    { enabled: selectedFilter !== null || summary.isSuccess || summary.isError, staleTime: 0 },
  );
  return {
    query,
    summary,
    data: query.data?.view === "all" ? query.data : undefined,
    page,
    setPage,
    filter,
    payment,
    setPayment,
    setFilter: (value: string | number | null): void => {
      setFilter(value === "paid" || value === "overdue" ? value : "all");
      setPage(1);
    },
    registered: (): void => {
      setPayment(null);
      setPage(1);
      void utils.students.list.invalidate();
    },
  };
}
