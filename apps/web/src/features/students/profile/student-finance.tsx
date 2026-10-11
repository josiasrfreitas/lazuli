import { useState, type ReactElement } from "react";
import {
  Badge,
  Button,
  DataTable,
  Tabs,
  TabsList,
  TabsTab,
  type DataTableColumn,
  type DataTableState,
} from "@lazuli/ui";
import { FINANCE_INSTALLMENTS_PAGE_SIZE, type FinanceInstallmentRow } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents as money } from "~/lib/format";
import { installmentVm, businessDate } from "~/features/installments/view-model";
import { PaymentDialog } from "~/features/installments/payment/payment-dialog";
import { ProfileMetric } from "./profile-shared";

type Row = FinanceInstallmentRow & { id: string };
type Filter = "all" | "overdue" | "paid";
export function StudentFinanceSection({ id }: { id: string }): ReactElement {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>("all");
  const [payment, setPayment] = useState<FinanceInstallmentRow | null>(null);
  const utils = trpc.useUtils();
  const totals = trpc.finance.installments.useQuery({
    studentId: id,
    view: "all",
    page: 1,
    pageSize: FINANCE_INSTALLMENTS_PAGE_SIZE,
  });
  const query = trpc.finance.installments.useQuery({
    studentId: id,
    view: "all",
    page,
    pageSize: FINANCE_INSTALLMENTS_PAGE_SIZE,
    statuses: filter === "all" ? undefined : [filter === "paid" ? "PAID" : "OVERDUE"],
  });
  const data = query.data?.view === "all" ? query.data : undefined;
  const rows = data?.rows.map((row) => ({ ...row, id: row.installmentId }));
  const registered = (): void => {
    setPayment(null);
    void utils.finance.installments.invalidate();
    void utils.students.preview.invalidate({ id });
    void utils.students.list.invalidate();
  };
  return (
    <div className="grid min-w-0 gap-6 pt-6">
      <div>
        <h2 className="text-lg font-semibold">Vida financeira</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cobranças e pagamentos vinculados a este aluno.
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-card p-4 sm:p-6">
        <ProfileMetric
          label="Parcelas"
          value={totals.data?.counts.all ?? "—"}
          detail="Total de lançamentos"
        />
        <ProfileMetric
          label="Vencidas"
          value={totals.data?.counts.overdue ?? "—"}
          detail="Aguardando quitação"
        />
        <ProfileMetric
          label="Pagas"
          value={totals.data?.counts.paid ?? "—"}
          detail="Parcelas quitadas"
        />
      </dl>
      <section className="grid min-w-0 gap-3">
        <Tabs
          value={filter}
          onValueChange={(value) => {
            setFilter(value === "paid" || value === "overdue" ? value : "all");
            setPage(1);
          }}
        >
          <TabsList aria-label="Filtrar parcelas">
            <TabsTab value="all">Todas</TabsTab>
            <TabsTab value="overdue">Vencidas</TabsTab>
            <TabsTab value="paid">Pagas</TabsTab>
          </TabsList>
        </Tabs>
        <DataTable
          label="Parcelas do aluno"
          columns={financeColumns(setPayment)}
          state={financeState({ rows, error: query.isError, filtered: filter !== "all" })}
          onRetry={() => void query.refetch()}
          errorTitle="Não foi possível carregar as parcelas"
          empty={{
            title: "Nenhuma cobrança vinculada",
            description: "As parcelas de contratos e pedidos deste aluno aparecerão aqui.",
          }}
          updating={query.isFetching && !query.isPending}
          pagination={
            data
              ? {
                  page,
                  pageSize: FINANCE_INSTALLMENTS_PAGE_SIZE,
                  pageCount: Math.max(1, data.pageCount),
                  totalItems: data.total,
                  onPageChange: setPage,
                  itemLabel: { singular: "parcela", plural: "parcelas" },
                }
              : { loading: true, page, pageSize: FINANCE_INSTALLMENTS_PAGE_SIZE }
          }
        />
      </section>
      <p className="text-caption text-muted-foreground">
        Pedidos compartilhados exibem o valor integral da parcela. Confira o pagador antes de
        receber.
      </p>
      {payment && (
        <PaymentDialog
          open
          rows={[payment]}
          onOpenChange={(open) => {
            if (!open) setPayment(null);
          }}
          onRegistered={registered}
        />
      )}
    </div>
  );
}
function financeState({
  rows,
  error,
  filtered,
}: {
  rows: Row[] | undefined;
  error: boolean;
  filtered: boolean;
}): DataTableState<Row> {
  if (error) return { kind: "error" };
  if (!rows) return { kind: "loading" };
  return rows.length ? { kind: "data", rows } : { kind: filtered ? "noResults" : "empty" };
}
function financeColumns(onReceive: (row: Row) => void): DataTableColumn<Row>[] {
  const today = businessDate(new Date());
  return [
    {
      id: "origin",
      header: "Cobrança / pagador",
      width: "wide",
      cell: (row) => (
        <div className="grid gap-1">
          <span className="font-medium">
            {installmentVm(row, today).origin} · {row.sequenceNumber}/{row.scheduleTotal}
          </span>
          <span className="text-caption text-muted-foreground">{row.payer.name}</span>
        </div>
      ),
    },
    {
      id: "due",
      header: "Vencimento",
      width: "narrow",
      cell: (row) => installmentVm(row, today).dueDate,
    },
    {
      id: "amount",
      header: "Valor / saldo",
      width: "standard",
      numeric: true,
      cell: (row) => (
        <div className="grid gap-1">
          <span>{money(row.originalAmountCents)}</span>
          {row.collectibleBalanceCents > 0 && (
            <span className="text-caption text-muted-foreground">
              Saldo {money(row.collectibleBalanceCents)}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Situação",
      width: "standard",
      cell: (row) => {
        const badge = installmentVm(row, today).badge;
        return <Badge variant={badge.variant}>{badge.label}</Badge>;
      },
    },
    {
      id: "action",
      header: <span className="sr-only">Ações</span>,
      width: "narrow",
      cell: (row) =>
        row.collectibleBalanceCents > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onReceive(row)}
            aria-label={`Receber parcela ${row.sequenceNumber} com vencimento em ${installmentVm(row, today).dueDate}`}
          >
            Receber
          </Button>
        ) : null,
    },
  ];
}
