import type { ReactElement } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Button, InlineSkeleton } from "@lazuli/ui";
import type { StudentFinanceSummary } from "@lazuli/domain";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import { ProfileError } from "./profile-shared";
import type { StudentFinanceState } from "./finance-logic";
import type { StudentProfile } from "./logic";
import { StudentContactSummary } from "./student-identity";
import { FinanceContractTerms } from "./finance-contract-terms";
import styles from "./student-profile.module.css";

export function FinanceOverview({
  state,
  profile,
}: {
  state: StudentFinanceState;
  profile: StudentProfile;
}): ReactElement {
  const { summary } = state;
  if (summary.isError)
    return (
      <ProfileError
        message="Não foi possível carregar o resumo financeiro."
        onRetry={() => void summary.refetch()}
      />
    );
  if (!summary.data)
    return (
      <div role="status" className="grid gap-4 py-5">
        <InlineSkeleton className="h-7 w-52" />
        <InlineSkeleton className="h-28 w-full" />
        <span className="sr-only">Carregando vida financeira</span>
      </div>
    );
  return (
    <section
      aria-label="Resumo financeiro"
      className="grid gap-x-8 gap-y-4 border border-border bg-accent px-5 py-4 lg:grid-cols-5"
    >
      <FinanceBalance summary={summary.data} />
      <PaymentBehavior summary={summary.data} studentId={profile.id} />
      <div className="grid gap-3 border-t border-border/60 pt-3 lg:col-span-5">
        <FinanceContractTerms summary={summary.data} />
        <StudentContactSummary profile={profile} />
      </div>
    </section>
  );
}

function FinanceBalance({ summary }: { summary: StudentFinanceSummary }): ReactElement {
  const progress =
    summary.totalCents > 0 ? Math.round((summary.receivedCents / summary.totalCents) * 100) : null;
  const hasDebt = summary.overdueCount > 0;
  return (
    <div className="grid content-start gap-4 lg:col-span-3">
      <div>
        <h2 className="flex items-center gap-3 font-display text-2xl font-medium text-heading">
          {summary.installmentCount === 0
            ? "Sem cobranças vinculadas"
            : hasDebt
              ? "Pendências em aberto"
              : summary.outstandingCents === 0
                ? "Sem saldo a receber"
                : "Em dia"}
          {hasDebt ? (
            <AlertCircle className="size-5 shrink-0 text-warning" aria-hidden />
          ) : summary.installmentCount > 0 ? (
            <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
          ) : null}
        </h2>
        <p className="mt-1 text-caption text-muted-foreground">
          {hasDebt
            ? `${money(summary.overdueCents)} em atraso · vencimento mais antigo há ${summary.oldestOverdueDays} dias`
            : summary.nextDueDate
              ? `Próximo vencimento em ${formatDateOnlyBR(summary.nextDueDate)} · ${money(summary.nextDueCents)}`
              : "Novas cobranças e recebimentos aparecerão aqui."}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-caption text-muted-foreground">Já recebido</dt>
          <dd className="mt-1 font-numeric text-3xl font-semibold tracking-tight tabular-nums text-heading">
            {money(summary.receivedCents)}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Saldo em aberto</dt>
          <dd className="mt-1 font-numeric text-3xl font-semibold tracking-tight tabular-nums text-heading">
            {money(summary.outstandingCents)}
          </dd>
        </div>
      </dl>
      <div className="grid gap-2">
        <meter
          className={styles.attendanceMeter}
          min={0}
          max={summary.totalCents || 1}
          value={summary.receivedCents}
          aria-label="Valor já pago"
          aria-valuetext={`${money(summary.receivedCents)} pagos de ${money(summary.totalCents)}`}
        />
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-caption text-muted-foreground">
          <span>
            {progress === null
              ? "Sem valores a acompanhar"
              : `${progress}% pago · total de ${money(summary.totalCents)}`}
          </span>
          <span>Inclui pagamentos parciais</span>
        </div>
      </div>
    </div>
  );
}

function PaymentBehavior({
  summary,
  studentId,
}: {
  summary: StudentFinanceSummary;
  studentId: string;
}): ReactElement {
  const history = summary.history;
  return (
    <div className="grid content-start gap-3 border-t border-border pt-4 lg:col-span-2 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
      <div>
        <h3 className="font-display text-2xl font-medium text-heading">{behaviorLabel(summary)}</h3>
        <p className="mt-1 text-caption text-muted-foreground">
          {history.lateMonths > 0
            ? `Atrasos em ${history.lateMonths} ${history.lateMonths === 1 ? "mês de vencimento" : "meses de vencimento"}, incluindo pendências atuais.`
            : history.settledCount > 0
              ? "Todas as quitações registradas ocorreram até o vencimento."
              : "A pontualidade aparecerá após os primeiros recebimentos."}
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <BehaviorFact label="Pagas em dia" value={String(history.onTimeCount)} />
        <BehaviorFact label="Pagas com atraso" value={String(history.lateCount)} />
        <BehaviorFact
          label="Atraso médio"
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
  if (history.lateMonths > 1) return "Atrasos recorrentes";
  if (history.lateMonths === 1) return "Atraso pontual";
  return history.settledCount > 0 ? "Pagamentos pontuais" : "Histórico em formação";
}
