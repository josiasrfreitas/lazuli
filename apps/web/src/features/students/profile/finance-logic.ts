import { useState } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { FINANCE_INSTALLMENTS_PAGE_SIZE, type FinanceInstallmentRow } from "@lazuli/validators";
import { trpc, type QueryResult } from "~/lib/trpc";
import { INSTALLMENT_STATUSES } from "~/features/installments/filters";
import type { InstallmentSituation } from "~/features/installments/column-policy";

export type FinanceData = Extract<RouterOutputs["finance"]["installments"], { view: "all" }>;
type Result = RouterOutputs["finance"]["installments"];
export type StudentFinanceState = {
  query: QueryResult<Result>;
  summary: QueryResult<RouterOutputs["finance"]["studentSummary"]>;
  data: FinanceData | undefined;
  page: number;
  setPage: (page: number) => void;
  situations: InstallmentSituation[];
  setSituations: (values: string[]) => void;
  payment: FinanceInstallmentRow | null;
  setPayment: (row: FinanceInstallmentRow | null) => void;
  registered: () => void;
};

export function useStudentFinance(
  id: string,
  providedSummary?: StudentFinanceState["summary"],
): StudentFinanceState {
  const [page, setPage] = useState(1);
  const [selectedSituations, setSelectedSituations] = useState<InstallmentSituation[] | null>(null);
  const [payment, setPayment] = useState<FinanceInstallmentRow | null>(null);
  const utils = trpc.useUtils();
  const ownSummary = trpc.finance.studentSummary.useQuery(
    { studentId: id },
    {
      enabled: providedSummary === undefined,
      staleTime: 0,
    },
  );
  const summary = providedSummary ?? ownSummary;
  const situations: InstallmentSituation[] =
    selectedSituations ?? (summary.data?.overdueCount ? ["OVERDUE"] : []);
  const query = trpc.finance.installments.useQuery(
    {
      studentId: id,
      view: "all",
      page,
      pageSize: FINANCE_INSTALLMENTS_PAGE_SIZE,
      ...(situations.length > 0 ? { statuses: situations } : {}),
    },
    {
      staleTime: 0,
      enabled: Boolean(
        summary.data && (summary.data.contracts.length > 0 || summary.data.installmentCount > 0),
      ),
    },
  );
  return {
    query,
    summary,
    data: query.data?.view === "all" ? query.data : undefined,
    page,
    setPage,
    situations,
    payment,
    setPayment,
    setSituations: (values): void => {
      setSelectedSituations(INSTALLMENT_STATUSES.filter((status) => values.includes(status)));
      setPage(1);
    },
    registered: (): void => {
      setPayment(null);
      setPage(1);
      void utils.finance.installments.invalidate();
      void utils.students.list.invalidate();
    },
  };
}
