import { useState, type ReactElement } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, CheckCircle2, FileText } from "lucide-react";
import {
  Button,
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
import { StudentPayments } from "./student-payments";
import { FinanceContractTerms } from "./finance-contract-terms";
import { FinanceHistoryDialog } from "./finance-history-dialog";
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

function FinanceDetails({
  summary,
  profile,
}: {
  summary: NonNullable<StudentFinanceState["summary"]["data"]>;
  profile: StudentProfile;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [proofPending, setProofPending] = useState(false);
  const pending = proofPending;
  const hasProofs = summary.hasPaymentProofs;
  return (
    <Dialog
      open={open}
      onOpenChange={(next, event) => {
        if (!next && pending) {
          event.cancel();
          return;
        }
        setOpen(next);
      }}
    >
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>
        <FileText aria-hidden="true" /> Contrato e detalhes
      </DialogTrigger>
      <DialogPortal>
        <div className={styles.detailsScope}>
          <DialogBackdrop data-finance-details-backdrop="" />
          <DialogContent
            data-finance-details-dialog=""
            data-proofs={hasProofs}
            showCloseButton={!pending}
          >
            <FinanceDialogContent
              summary={summary}
              profile={profile}
              hasProofs={hasProofs}
              onProofPending={setProofPending}
            />
          </DialogContent>
        </div>
      </DialogPortal>
    </Dialog>
  );
}

function FinanceDialogContent({
  summary,
  profile,
  hasProofs,
  onProofPending,
}: {
  summary: NonNullable<StudentFinanceState["summary"]["data"]>;
  profile: StudentProfile;
  hasProofs: boolean;
  onProofPending: (pending: boolean) => void;
}): ReactElement {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Contrato e detalhes</DialogTitle>
        <DialogDescription>{profile.contact.fullName}</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div className={styles.detailsLayout} data-with-proofs={hasProofs || undefined}>
          <div className={styles.details}>
            <FinanceContractTerms summary={summary} />
            <details className={styles.paymentHistory}>
              <summary>Histórico de pagamentos</summary>
              <PaymentBehavior
                summary={summary}
                studentId={profile.id}
                studentName={profile.contact.fullName}
              />
            </details>
          </div>
          {hasProofs && (
            <aside className={styles.proofs} aria-label="Comprovantes">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-heading">Comprovantes</h3>
                <span className="text-caption text-muted-foreground">Mais recentes primeiro</span>
              </div>
              <StudentPayments studentId={profile.id} withProofs onPendingChange={onProofPending} />
            </aside>
          )}
        </div>
      </DialogBody>
    </>
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
    <div className="grid content-start gap-3 border-t border-border pt-4">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h3
            className={`text-sm font-semibold ${history.paymentState === "RECURRING_DELAY" ? "text-warning" : "text-heading"}`}
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
