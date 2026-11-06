import type { ReactElement } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { StudentFinanceSummary } from "@lazuli/domain";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import { ProfileError } from "./profile-shared";
import type { StudentFinanceState } from "./finance-logic";
import type { StudentProfile } from "./logic";
import { FinanceDetails } from "./finance-details-dialog";
import { ContractTerminationNotice } from "./contract-termination-notice";
import { FinanceOverviewLoading } from "./finance-overview-loading";
import { FinanceContractDates } from "./finance-contract-dates";
import { StudentMaterials } from "./student-materials";
import styles from "./finance-overview.module.css";

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
          <StudentMaterials
            studentId={profile.id}
            studentName={profile.contact.fullName}
            summary={summary.data}
          />
          <FinanceDetails summary={summary.data} profile={profile} />
        </div>
      </div>
      <div className={styles.overviewFacts}>
        <FinanceEssentials summary={summary.data} />
        <FinanceContractDates summary={summary.data} />
      </div>
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
            ? `${summary.overdueCount} ${summary.overdueCount === 1 ? "cobrança em atraso" : "cobranças em atraso"}`
            : "Nenhuma cobrança em atraso"}
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
        <span>Inclui cobranças vencidas e a vencer</span>
      </div>
    </dl>
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
    return `${summary.overdueCount} ${summary.overdueCount === 1 ? "cobrança vencida" : "cobranças vencidas"} · maior atraso de ${summary.oldestOverdueDays} dias`;
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
