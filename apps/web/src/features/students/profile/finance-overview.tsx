import type { ReactElement } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Button, PencilLoader, Tooltip, TooltipTrigger, TooltipContent } from "@lazuli/ui";
import type { StudentFinanceSummary } from "@lazuli/domain";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import { ProfileError } from "./profile-shared";
import type { StudentFinanceState } from "./finance-logic";
import type { StudentProfile } from "./logic";
import { StudentContactSummary } from "./student-identity";
import { FinanceContractTerms } from "./finance-contract-terms";
import { FinanceHistoryDialog } from "./finance-history-dialog";
import { ContractTerminationNotice } from "./contract-termination-notice";

export function FinanceOverview({
  state,
  profile,
}: {
  state: StudentFinanceState;
  profile?: StudentProfile;
}): ReactElement {
  const { summary } = state;
  if (summary.isError)
    return (
      <ProfileError
        message="Não foi possível carregar o resumo financeiro."
        onRetry={() => void summary.refetch()}
        isRetrying={summary.isFetching}
      />
    );
  if (!summary.data || !profile)
    return (
      <section
        aria-label="Resumo financeiro"
        className="flex min-h-72 items-center justify-center border border-border bg-accent px-5 py-4"
      >
        <PencilLoader label="Carregando resumo financeiro" />
      </section>
    );
  return (
    <section
      aria-label="Resumo financeiro"
      className={`grid gap-x-8 gap-y-4 border px-5 py-4 lg:grid-cols-5 ${
        summary.data.debtState === "SEVERE_OVERDUE"
          ? "border-destructive/50 bg-destructive/5"
          : "border-border bg-accent"
      }`}
    >
      {summary.data.latestTermination && (
        <div className="lg:col-span-5">
          <ContractTerminationNotice termination={summary.data.latestTermination} />
        </div>
      )}
      <FinanceBalance
        summary={summary.data}
        contractTerminated={Boolean(
          summary.data.latestTermination && !summary.data.contracts.length,
        )}
      />
      <PaymentBehavior
        summary={summary.data}
        studentId={profile.id}
        studentName={profile.contact.fullName}
      />
      <div className="grid gap-3 border-t border-border/60 pt-3 lg:col-span-5">
        <FinanceContractTerms summary={summary.data} />
        <StudentContactSummary profile={profile} highlightWhatsApp />
      </div>
    </section>
  );
}

function FinanceBalance({
  summary,
  contractTerminated,
}: {
  summary: StudentFinanceSummary;
  contractTerminated: boolean;
}): ReactElement {
  const hasDebt = summary.debtState !== "NO_OVERDUE";
  const severe = summary.debtState === "SEVERE_OVERDUE";
  return (
    <div className="grid content-start gap-4 lg:col-span-3">
      <div>
        <h2
          className={`flex items-center gap-3 font-display text-2xl font-medium ${hasDebt ? "text-destructive" : "text-heading"}`}
        >
          {summary.installmentCount === 0
            ? "Sem cobranças vinculadas"
            : hasDebt
              ? severe
                ? "Pendência grave · ação prioritária"
                : "Pagamento em atraso"
              : summary.outstandingCents === 0
                ? "Sem saldo a receber"
                : contractTerminated
                  ? "Saldo pendente após rescisão"
                  : "Em dia"}
          {hasDebt ? (
            <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden />
          ) : summary.installmentCount > 0 ? (
            <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
          ) : null}
        </h2>
        <p className="mt-1 text-caption text-muted-foreground">
          {hasDebt
            ? `${summary.overdueCount} ${summary.overdueCount === 1 ? "parcela vencida" : "parcelas vencidas"} · maior atraso de ${summary.oldestOverdueDays} dias`
            : summary.nextDueDate
              ? `Próximo vencimento em ${formatDateOnlyBR(summary.nextDueDate)} · ${money(summary.nextDueCents)}`
              : "Novas cobranças e recebimentos aparecerão aqui."}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <dt className={`text-caption ${hasDebt ? "text-destructive" : "text-muted-foreground"}`}>
            Total vencido
          </dt>
          <dd
            className={`mt-1 font-numeric text-3xl font-semibold tracking-tight tabular-nums ${hasDebt ? "text-destructive" : "text-heading"}`}
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
      <FinanceDistribution summary={summary} />
    </div>
  );
}

function FinanceDistribution({ summary }: { summary: StudentFinanceSummary }): ReactElement {
  const total = summary.totalCents || 1;
  const paid = (summary.receivedCents / total) * 100;
  const overdue = (summary.overdueCents / total) * 100;
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

function PaymentBehavior({
  summary,
  studentId,
  studentName,
}: {
  summary: StudentFinanceSummary;
  studentId: string;
  studentName: string;
}): ReactElement {
  const history = summary.history;
  return (
    <div className="grid content-start gap-3 border-t border-border pt-4 lg:col-span-2 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h3
            className={`font-display text-2xl font-medium ${history.paymentState === "RECURRING_DELAY" ? "text-warning" : "text-heading"}`}
          >
            {behaviorLabel(summary)}
          </h3>
          <FinanceHistoryDialog studentId={studentId} studentName={studentName} />
        </div>
        <p className="mt-1 text-caption text-muted-foreground">
          {history.paymentState === "RECURRING_DELAY"
            ? `Pagamentos quitados com atraso em ${history.settledLateMonths} meses. Acompanhe os próximos vencimentos.`
            : history.paymentState === "OCCASIONAL_DELAY"
              ? "Há pagamento quitado com atraso em um mês de vencimento."
              : history.settledCount > 0
                ? "Todas as quitações registradas ocorreram até o vencimento."
                : "A pontualidade aparecerá após as primeiras quitações."}
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <BehaviorFact label="Pagas em dia" value={String(history.onTimeCount)} />
        <BehaviorFact label="Pagas com atraso" value={String(history.lateCount)} />
        <BehaviorFact
          label="Atraso médio nas quitações"
          value={history.averageLateDays === null ? "—" : `${history.averageLateDays} dias`}
        />
      </dl>
      <div>
        <Button
          variant="link"
          size="inline"
          nativeButton={false}
          render={<Link href={`/recebiveis?aluno=${studentId}`} />}
        >
          Ver situação completa em Recebíveis <ArrowUpRight aria-hidden="true" />
        </Button>
      </div>
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

function behaviorLabel({ history }: StudentFinanceSummary): string {
  switch (history.paymentState) {
    case "RECURRING_DELAY":
      return "Atrasos recorrentes";
    case "OCCASIONAL_DELAY":
      return "Atraso pontual nas quitações";
    case "ON_TIME":
      return "Pagamentos pontuais";
    case "INSUFFICIENT_HISTORY":
      return "Histórico em formação";
  }
}
