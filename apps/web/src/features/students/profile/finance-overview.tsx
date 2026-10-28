import type { ReactElement } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, CheckCircle2, FileText } from "lucide-react";
import {
  Button,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@lazuli/ui";
import type { StudentFinanceSummary } from "@lazuli/domain";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import { ProfileError } from "./profile-shared";
import type { StudentFinanceState } from "./finance-logic";
import type { StudentProfile } from "./logic";
import { FinanceContractTerms } from "./finance-contract-terms";
import { FinanceHistoryDialog } from "./finance-history-dialog";
import { ContractTerminationNotice } from "./contract-termination-notice";
import { FinanceOverviewLoading } from "./finance-overview-loading";
import styles from "./finance-overview.module.css";

const PERCENT_SCALE = 100;
const DEBT_TEXT = "text-destructive";
const STANDARD_TEXT = "text-heading";

export function FinanceOverview({
  state,
  profile,
}: {
  state: StudentFinanceState;
  profile?: StudentProfile | undefined;
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
  if (!summary.data || !profile) return <FinanceOverviewLoading />;
  return (
    <section aria-label="Resumo financeiro" className={styles.overview}>
      <ContractTerminationNotice termination={summary.data.latestTermination} />
      <div className={styles.heading}>
        <FinanceBalanceHeading
          summary={summary.data}
          contractTerminated={Boolean(
            summary.data.latestTermination && summary.data.contracts.length === 0,
          )}
          hasDebt={summary.data.overdueCount > 0}
        />
        <div className="flex flex-wrap items-center gap-2">
          <FinanceHistoryDialog
            studentId={profile.id}
            studentName={profile.contact.fullName}
            payments
          />
          <FinanceDetails summary={summary.data} profile={profile} />
        </div>
      </div>
      <FinanceEssentials summary={summary.data} />
    </section>
  );
}

function FinanceEssentials({
  summary,
}: {
  summary: NonNullable<StudentFinanceState["summary"]["data"]>;
}): ReactElement {
  return (
    <dl className={styles.essentials}>
      <div data-overdue={summary.overdueCount > 0 || undefined}>
        <dt>Total vencido</dt>
        <dd>{money(summary.overdueCents)}</dd>
        <span>
          {summary.overdueCount > 0
            ? `${summary.overdueCount} ${summary.overdueCount === 1 ? "parcela em atraso" : "parcelas em atraso"}`
            : "Nenhuma parcela em atraso"}
        </span>
      </div>
      <div>
        <dt>Próximo vencimento</dt>
        <dd>{summary.nextDueDate ? money(summary.nextDueCents) : "—"}</dd>
        <span>
          {summary.nextDueDate ? formatDateOnlyBR(summary.nextDueDate) : "Nenhuma cobrança futura"}
        </span>
      </div>
      <div>
        <dt>Saldo a receber</dt>
        <dd>{money(summary.outstandingCents)}</dd>
        <span>Inclui parcelas vencidas e a vencer</span>
      </div>
    </dl>
  );
}

function FinanceDetails({
  summary,
  profile,
}: {
  summary: NonNullable<StudentFinanceState["summary"]["data"]>;
  profile: StudentProfile;
}): ReactElement {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>
        <FileText aria-hidden="true" /> Contrato e detalhes
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="md:max-w-4xl" data-student-dialog-motion>
          <DialogHeader>
            <DialogTitle>Detalhes financeiros</DialogTitle>
            <DialogDescription>
              {profile.contact.fullName} · Contrato e pagamentos
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className={styles.details}>
              <FinanceContractTerms summary={summary} />
              <div className="grid gap-6 lg:grid-cols-5">
                <FinanceBalance
                  summary={summary}
                  contractTerminated={Boolean(
                    summary.latestTermination && summary.contracts.length === 0,
                  )}
                />
                <PaymentBehavior
                  summary={summary}
                  studentId={profile.id}
                  studentName={profile.contact.fullName}
                />
              </div>
            </div>
          </DialogBody>
        </DialogContent>
      </DialogPortal>
    </Dialog>
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
  return (
    <div className="grid content-start gap-4 lg:col-span-3">
      <FinanceBalanceHeading
        summary={summary}
        contractTerminated={contractTerminated}
        hasDebt={hasDebt}
      />
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <dt className={`text-caption ${hasDebt ? DEBT_TEXT : "text-muted-foreground"}`}>
            Total vencido
          </dt>
          <dd
            className={`mt-1 font-numeric text-3xl font-semibold tracking-tight tabular-nums ${hasDebt ? DEBT_TEXT : STANDARD_TEXT}`}
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

function FinanceBalanceHeading({
  summary,
  contractTerminated,
  hasDebt,
}: {
  summary: StudentFinanceSummary;
  contractTerminated: boolean;
  hasDebt: boolean;
}): ReactElement {
  return (
    <div>
      <h2
        className={`flex items-center gap-3 font-display text-2xl font-medium ${hasDebt ? DEBT_TEXT : STANDARD_TEXT}`}
      >
        {financeBalanceLabel(summary, contractTerminated)}
        <FinanceBalanceIcon hasDebt={hasDebt} installmentCount={summary.installmentCount} />
      </h2>
      <p className="mt-1 text-caption text-muted-foreground">
        {financeBalanceDescription(summary, hasDebt)}
      </p>
    </div>
  );
}

function FinanceBalanceIcon({
  hasDebt,
  installmentCount,
}: {
  hasDebt: boolean;
  installmentCount: number;
}): ReactElement | null {
  if (hasDebt) return <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden />;
  if (installmentCount > 0)
    return <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />;
  return null;
}

function financeBalanceDescription(summary: StudentFinanceSummary, hasDebt: boolean): string {
  if (hasDebt)
    return `${summary.overdueCount} ${summary.overdueCount === 1 ? "parcela vencida" : "parcelas vencidas"} · maior atraso de ${summary.oldestOverdueDays} dias`;
  if (summary.nextDueDate)
    return `Próximo vencimento em ${formatDateOnlyBR(summary.nextDueDate)} · ${money(summary.nextDueCents)}`;
  return "Novas cobranças e recebimentos aparecerão aqui.";
}

function financeBalanceLabel(summary: StudentFinanceSummary, contractTerminated: boolean): string {
  if (summary.installmentCount === 0) return "Sem cobranças vinculadas";
  if (summary.debtState === "SEVERE_OVERDUE") return "Pendência grave · ação prioritária";
  if (summary.debtState !== "NO_OVERDUE") return "Pagamento em atraso";
  if (summary.outstandingCents === 0) return "Sem saldo a receber";
  return contractTerminated ? "Saldo pendente após rescisão" : "Em dia";
}

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
          {paymentBehaviorDescription(summary)}
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

function paymentBehaviorDescription({ history }: StudentFinanceSummary): string {
  if (history.paymentState === "RECURRING_DELAY")
    return `Pagamentos quitados com atraso em ${history.settledLateMonths} meses. Acompanhe os próximos vencimentos.`;
  if (history.paymentState === "OCCASIONAL_DELAY")
    return "Há pagamento quitado com atraso em um mês de vencimento.";
  if (history.settledCount > 0) return "Todas as quitações registradas ocorreram até o vencimento.";
  return "A pontualidade aparecerá após as primeiras quitações.";
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
