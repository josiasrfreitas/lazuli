import type { ReactElement } from "react";
import { formatBRLFromCents as money } from "~/lib/format";
import type { FinanceContract, FinanceSchedule } from "./contract-invoice";
import styles from "./contract-invoice.module.css";

type TuitionTerms = Pick<
  FinanceContract,
  "baseMonthlyAmountCents" | "monthlyAmountCents" | "scholarshipPct"
>;

/** Reconciles the displayed item prices with the school's adjusted receivable ledger. */
export function invoiceTotals(
  rows: FinanceSchedule[],
  tuition?: TuitionTerms,
): {
  subtotal: number;
  discounts: number;
  fee: number;
  adjustments: number;
  received: number;
  balance: number;
} {
  const gross = rows.reduce(
    (sum, row) => sum + (row.material?.chargedAmountCents ?? row.totalCents),
    0,
  );
  const discounts = rows.reduce((sum, row) => sum + itemDiscount(row, tuition), 0);
  const fee = rows.reduce((sum, row) => sum + (row.material?.cardFeeCents ?? 0), 0);
  const received = rows.reduce((sum, row) => sum + row.collection.receivedCents, 0);
  const balance = rows.reduce((sum, row) => sum + row.collection.balanceCents, 0);
  return {
    subtotal: gross + discounts,
    discounts,
    fee,
    adjustments: received + balance - (gross - fee),
    received,
    balance,
  };
}

function itemDiscount(row: FinanceSchedule, tuition?: TuitionTerms): number {
  if (row.material)
    return Math.max(
      0,
      row.material.listPriceCents - (row.material.chargedAmountCents ?? row.totalCents),
    );
  if (row.kind !== "TUITION" || !tuition || tuition.scholarshipPct <= 0) return 0;
  const monthlyDiscount = (tuition.baseMonthlyAmountCents ?? 0) - (tuition.monthlyAmountCents ?? 0);
  return Math.max(0, monthlyDiscount) * row.installmentCount;
}

export function InvoiceTotals({
  rows,
  tuition,
}: {
  rows: FinanceSchedule[];
  tuition: TuitionTerms;
}): ReactElement {
  const totals = invoiceTotals(rows, tuition);
  return (
    <dl className={styles.totals} aria-label="Composição do saldo do contrato">
      <div>
        <dt>Subtotal</dt>
        <dd>{money(totals.subtotal)}</dd>
      </div>
      {totals.discounts > 0 && (
        <div>
          <dt>Bolsas e descontos</dt>
          <dd>{signedMoney(-totals.discounts)}</dd>
        </div>
      )}
      {totals.fee !== 0 && (
        <div>
          <dt>Taxas do cartão</dt>
          <dd>{signedMoney(-totals.fee)}</dd>
        </div>
      )}
      {totals.adjustments !== 0 && (
        <div>
          <dt>Ajustes nas cobranças</dt>
          <dd>{signedMoney(totals.adjustments)}</dd>
        </div>
      )}
      <div>
        <dt>Recebido pela escola</dt>
        <dd>
          {totals.received > 0 ? "− " : ""}
          {money(totals.received)}
        </dd>
      </div>
      <div className={styles.balance}>
        <dt>Saldo a receber</dt>
        <dd>{money(totals.balance)}</dd>
      </div>
    </dl>
  );
}

function signedMoney(amount: number): string {
  return `${amount < 0 ? "−" : "+"} ${money(Math.abs(amount))}`;
}
