import { PendingPagination, PENDING_PAGE_SIZE } from "./home-pending-pagination";
import { useState, type ReactElement } from "react";
import Link from "next/link";
import { ChevronDown, CalendarClock, SquareArrowOutUpRight, ArrowUpRight } from "lucide-react";
import { Button } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import type { BusinessData } from "./home-metrics";
import { PendingDisclosure } from "./home-pending-disclosure";
import styles from "./home-pending.module.css";

const CENTS_PER_REAL = 100;
const money = (cents: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / CENTS_PER_REAL,
  );

type OverdueContracts = RouterOutputs["dashboard"]["overdueContracts"];

function ReceivablesLink(): ReactElement {
  return (
    <Button
      nativeButton={false}
      variant="ghost"
      size="icon-sm"
      aria-label="Abrir recebíveis vencidos"
      title="Abrir recebíveis vencidos"
      render={<Link href="/recebiveis?status=vencidas" />}
    >
      <SquareArrowOutUpRight aria-hidden="true" />
    </Button>
  );
}

function FinanceSummary({
  contracts,
  loaded,
  total,
}: {
  contracts: OverdueContracts;
  loaded: boolean;
  total: number;
}): ReactElement {
  const installmentCount = contracts.reduce((sum, contract) => sum + contract.installmentCount, 0);
  return (
    <>
      <span className={`${styles.icon} ${styles.financeIcon}`}>
        <CalendarClock aria-hidden="true" />
      </span>
      <span className={styles.identity}>
        <strong>Parcelas em atraso</strong>
        <span>
          {loaded
            ? `${contracts.length} ${contracts.length === 1 ? "contrato" : "contratos"} · ${installmentCount} ${installmentCount === 1 ? "parcela" : "parcelas"}`
            : "Carregando contratos…"}
        </span>
      </span>
      <strong className={styles.amount}>{money(total)}</strong>
      <span className={styles.action}>
        <ChevronDown aria-hidden="true" />
      </span>
    </>
  );
}

function FinanceCases({
  contracts,
  isPending,
  isError,
  onRetry,
}: {
  contracts: OverdueContracts;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}): ReactElement {
  const [requestedPage, setPage] = useState(1);
  const page = Math.min(
    requestedPage,
    Math.max(1, Math.ceil(contracts.length / PENDING_PAGE_SIZE)),
  );
  return (
    <div className={styles.financeCases}>
      {contracts.slice((page - 1) * PENDING_PAGE_SIZE, page * PENDING_PAGE_SIZE).map((contract) => (
        <ContractCase key={contract.contractId} contract={contract} />
      ))}
      <PendingPagination
        total={contracts.length}
        page={page}
        onPageChange={setPage}
        label="Paginação de contratos em atraso"
      />
      {isPending && (
        <p className={styles.feedback} role="status">
          Carregando casos…
        </p>
      )}
      {isError && (
        <p className={styles.feedback}>
          Não foi possível carregar todos os casos.{" "}
          <button type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        </p>
      )}
      {!isPending && !isError && contracts.length === 0 && (
        <p className={styles.feedback}>Nenhuma parcela em atraso.</p>
      )}
    </div>
  );
}

export function PendingFinance({ business }: { business: BusinessData }): ReactElement {
  const query = trpc.dashboard.overdueContracts.useQuery(undefined, {
    staleTime: 0,
    refetchInterval: 60_000,
  });
  const contracts = query.data ?? [];
  const total = query.data
    ? contracts.reduce((sum, contract) => sum + contract.balanceCents, 0)
    : business.overdueCents;
  return (
    <tr>
      <td className={styles.cell}>
        <PendingDisclosure
          action={<ReceivablesLink />}
          summary={
            <FinanceSummary contracts={contracts} loaded={Boolean(query.data)} total={total} />
          }
        >
          <FinanceCases
            contracts={contracts}
            isPending={query.isPending}
            isError={query.isError}
            onRetry={() => void query.refetch()}
          />
        </PendingDisclosure>
      </td>
    </tr>
  );
}

function ContractCase({
  contract,
}: {
  contract: RouterOutputs["dashboard"]["overdueContracts"][number];
}): ReactElement {
  const days = `${contract.overdueDays} ${contract.overdueDays === 1 ? "dia" : "dias"}`;
  const installments = `${contract.installmentCount} ${contract.installmentCount === 1 ? "parcela vencida" : "parcelas vencidas"}`;
  return (
    <Link
      className={styles.financeCase}
      href={`/alunos/${contract.studentId}?secao=financeiro&voltar=%2F`}
      aria-label={`${contract.studentName}, ${installments}, maior atraso de ${days}, ${money(contract.balanceCents)}. Abrir financeiro`}
      title={`${contract.studentName} · ${installments} · ${days} de atraso`}
    >
      <span className={styles.caseIdentity}>
        <strong className={styles.caseName}>{contract.studentName}</strong>
        <span className={styles.caseContext}>{days}</span>
      </span>
      <strong className={styles.amount}>{money(contract.balanceCents)}</strong>
      <span className={styles.caseAction}>
        <ArrowUpRight aria-hidden="true" />
      </span>
    </Link>
  );
}
