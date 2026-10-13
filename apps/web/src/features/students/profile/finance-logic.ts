import { useState } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { FINANCE_INSTALLMENTS_PAGE_SIZE, type FinanceInstallmentRow } from "@lazuli/validators";
import { trpc, type QueryResult } from "~/lib/trpc";
export type FinanceFilter = "all" | "overdue" | "paid";
type Result = RouterOutputs["finance"]["installments"];
export type StudentFinanceState = {
  query: QueryResult<Result>;
  summary: QueryResult<RouterOutputs["finance"]["studentSummary"]>;
  data: Extract<Result, { view: "all" }> | undefined;
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
  const [filter, setFilter] = useState<FinanceFilter>("overdue");
  const [payment, setPayment] = useState<FinanceInstallmentRow | null>(null);
  const utils = trpc.useUtils();
  const summary = trpc.finance.studentSummary.useQuery({ studentId: id });
  const query = trpc.finance.installments.useQuery({
    studentId: id,
    view: "all",
    page,
    pageSize: FINANCE_INSTALLMENTS_PAGE_SIZE,
    statuses: filter === "all" ? undefined : [filter === "paid" ? "PAID" : "OVERDUE"],
  });
  return {
    query,
    summary,
    data: query.data?.view === "all" ? query.data : undefined,
    page,
    setPage,
    filter,
    payment,
    setPayment,
    setFilter: (value) => {
      setFilter(value === "paid" || value === "overdue" ? value : "all");
      setPage(1);
    },
    registered: () => {
      setPayment(null);
      void utils.finance.installments.invalidate();
      void utils.finance.studentSummary.invalidate({ studentId: id });
      void utils.students.list.invalidate();
    },
  };
}
