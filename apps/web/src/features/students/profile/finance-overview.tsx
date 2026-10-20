import type { ReactElement } from "react";
import { AlertCircle } from "lucide-react";
import { InlineSkeleton, Tooltip, TooltipTrigger, TooltipContent } from "@lazuli/ui";
import type { StudentFinanceSummary } from "@lazuli/domain";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import { ProfileError } from "./profile-shared";
import type { StudentFinanceState } from "./finance-logic";

const HEADING_COLOR = "text-heading";

export function FinanceOverview({ state }: { state: StudentFinanceState }): ReactElement {
  const { summary } = state;
  if (summary.isError)
    return (
      <ProfileError
        message="Não foi possível carregar o resumo financeiro."
        onRetry={() => void summary.refetch()}
        isRetrying={summary.isFetching}
      />
    );
  if (!summary.data)
    return (
      <section
        aria-label="Resumo financeiro"
        className="flex min-h-48 items-center justify-center border border-border bg-accent px-5 py-4"
      >
        <div role="status" className="w-full">
          <InlineSkeleton className="h-24 w-full" />
          <span className="sr-only">Carregando resumo financeiro</span>
        </div>
      </section>
    );
  return (
    <section
      aria-label="Resumo financeiro"
      className={`grid gap-x-8 gap-y-4 border px-5 py-4 lg:grid-cols-5 ${summary.data.debtState === "SEVERE_OVERDUE" ? "border-destructive/50 bg-destructive/5" : "border-border bg-accent"}`}
    >
      <FinanceBalance summary={summary.data} />
      <PaymentBehavior summary={summary.data} />
    </section>
  );
}

function FinanceBalance({ summary }: { summary: StudentFinanceSummary }): ReactElement {
  return (
    <div className="grid content-start gap-4 lg:col-span-3">
      <BalanceHeading summary={summary} />
      <BalanceValues summary={summary} />
      <FinanceDistribution summary={summary} />
    </div>
  );
}

function BalanceHeading({ summary }: { summary: StudentFinanceSummary }): ReactElement {
  const hasDebt = summary.debtState !== "NO_OVERDUE";
  return (
    <div>
      <h2
        className={`flex items-center gap-3 font-display text-2xl font-medium ${hasDebt ? "text-destructive" : HEADING_COLOR}`}
      >
        {balanceTitle(summary)}
        {hasDebt && <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden />}
      </h2>
      <p className="mt-1 text-caption text-muted-foreground">{balanceDescription(summary)}</p>
    </div>
  );
}

function balanceTitle(summary: StudentFinanceSummary): string {
  if (summary.installmentCount === 0) return "Sem cobranças vinculadas";
  if (summary.debtState === "SEVERE_OVERDUE") return "Pendência grave · ação prioritária";
  if (summary.debtState === "OVERDUE") return "Pagamento em atraso";
  return summary.outstandingCents === 0 ? "Sem saldo a receber" : "Em dia";
}

function balanceDescription(summary: StudentFinanceSummary): string {
  if (summary.debtState !== "NO_OVERDUE")
    return `${summary.overdueCount} ${summary.overdueCount === 1 ? "parcela vencida" : "parcelas vencidas"} · maior atraso de ${summary.oldestOverdueDays} dias`;
  if (summary.nextDueDate)
    return `Próximo vencimento em ${formatDateOnlyBR(summary.nextDueDate)} · ${money(summary.nextDueCents)}`;
  return "Novas cobranças e recebimentos aparecerão aqui.";
}

function BalanceValues({ summary }: { summary: StudentFinanceSummary }): ReactElement {
  const debtColor = summary.debtState === "NO_OVERDUE" ? "text-heading" : "text-destructive";
  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <div>
        <dt className={`text-caption ${debtColor}`}>Total vencido</dt>
        <dd
          className={`mt-1 font-numeric text-3xl font-semibold tracking-tight tabular-nums ${debtColor}`}
        >
          {money(summary.overdueCents)}
        </dd>
      </div>
      <div>
        <dt className="text-caption text-info">Já recebido</dt>
        <dd className="mt-1 font-numeric text-3xl font-semibold tracking-tight tabular-nums text-info">
          {money(summary.receivedCents)}
        </dd>
      </div>
      <div>
        <dt className="text-caption text-muted-foreground">A vencer</dt>
        <dd className="mt-1 font-numeric text-3xl font-semibold tracking-tight tabular-nums text-heading">
          {money(summary.outstandingCents - summary.overdueCents)}
        </dd>
      </div>
    </dl>
  );
}

const PERCENT_SCALE = 100;
function FinanceDistribution({ summary }: { summary: StudentFinanceSummary }): ReactElement {
  const total = summary.totalCents || 1;
  const paid = (summary.receivedCents / total) * PERCENT_SCALE;
  const overdue = (summary.overdueCents / total) * PERCENT_SCALE;
  const upcoming = summary.outstandingCents - summary.overdueCents;
  const description = `Pago: ${money(summary.receivedCents)}. Em atraso: ${money(summary.overdueCents)}. A vencer: ${money(upcoming)}.`;
  return (
    <div className="grid gap-2">
      <Tooltip>
        <TooltipTrigger
          render={<div />}
          tabIndex={0}
          aria-label={description}
          className="flex min-h-6 items-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <svg
            className="h-3 w-full overflow-hidden rounded-sm"
            viewBox="0 0 100 12"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <rect width="100" height="12" className="fill-border" />
            <rect width={paid} height="12" className="fill-info" />
            <rect x={paid} width={overdue} height="12" className="fill-destructive" />
          </svg>
        </TooltipTrigger>
        <TooltipContent>
          <ul className="grid gap-1">
            <li>Pago: {money(summary.receivedCents)}</li>
            <li>Em atraso: {money(summary.overdueCents)}</li>
            <li>A vencer: {money(upcoming)}</li>
          </ul>
        </TooltipContent>
      </Tooltip>
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-caption text-muted-foreground">
        <span>
          {summary.totalCents > 0
            ? `Total de ${money(summary.totalCents)}`
            : "Sem valores a acompanhar"}
        </span>
        <span>Inclui pagamentos parciais</span>
      </div>
    </div>
  );
}

function PaymentBehavior({ summary }: { summary: StudentFinanceSummary }): ReactElement {
  const history = summary.history;
  return (
    <div className="grid content-start gap-3 border-t border-border pt-4 lg:col-span-2 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
      <div>
        <h3
          className={`font-display text-2xl font-medium ${history.paymentState === "RECURRING_DELAY" ? "text-warning" : HEADING_COLOR}`}
        >
          {behaviorLabel(history.paymentState)}
        </h3>
        <p className="mt-1 text-caption text-muted-foreground">{behaviorDescription(history)}</p>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <BehaviorFact label="Pagas em dia" value={String(history.onTimeCount)} />
        <BehaviorFact label="Pagas com atraso" value={String(history.lateCount)} />
        <BehaviorFact
          label="Atraso médio nas quitações"
          value={history.averageLateDays === null ? "—" : `${history.averageLateDays} dias`}
        />
      </dl>
    </div>
  );
}

function BehaviorFact({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-numeric text-xl font-semibold tabular-nums text-heading">{value}</dd>
    </div>
  );
}

function behaviorLabel(state: StudentFinanceSummary["history"]["paymentState"]): string {
  switch (state) {
    case "RECURRING_DELAY": {
      return "Atrasos recorrentes";
    }
    case "OCCASIONAL_DELAY": {
      return "Atraso pontual nas quitações";
    }
    case "ON_TIME": {
      return "Pagamentos pontuais";
    }
    case "INSUFFICIENT_HISTORY": {
      return "Histórico em formação";
    }
  }
}

function behaviorDescription(history: StudentFinanceSummary["history"]): string {
  if (history.paymentState === "RECURRING_DELAY")
    return `Pagamentos quitados com atraso em ${history.settledLateMonths} meses. Acompanhe os próximos vencimentos.`;
  if (history.paymentState === "OCCASIONAL_DELAY")
    return "Há pagamento quitado com atraso em um mês de vencimento.";
  return history.settledCount > 0
    ? "Todas as quitações registradas ocorreram até o vencimento."
    : "A pontualidade aparecerá após as primeiras quitações.";
}
