import type { ReactElement, ReactNode } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Badge } from "@lazuli/ui";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import { materialPaymentLabel } from "~/features/contracts/material-payment-label";
import styles from "./contract-invoice.module.css";

export type FinanceContract = RouterOutputs["finance"]["studentSummary"]["contracts"][number];
export type FinanceSchedule = FinanceContract["schedules"][number];
const FULL_SCHOLARSHIP_PCT = 100;

export function ContractInvoice({ contract }: { contract: FinanceContract }): ReactElement {
  const rows = [...contract.schedules].toSorted(
    (left, right) => Number(right.kind === "TUITION") - Number(left.kind === "TUITION"),
  );
  const tuition = rows.find((row) => row.kind === "TUITION");
  const reduction = contract.renegotiations?.reduce((sum, row) => sum + row.reductionCents, 0) ?? 0;
  return (
    <div className={styles.container}>
      <dl className={styles.meta}>
        <Meta label="Vigência">
          {contract.startsOn && contract.endsOn
            ? `${formatDateOnlyBR(contract.startsOn)} a ${formatDateOnlyBR(contract.endsOn)}`
            : "Não informada"}
        </Meta>
        <Meta label="Pagador">{contract.payerName}</Meta>
        <Meta label="Vencimento">{tuition ? `Todo dia ${tuition.dueDay}` : "—"}</Meta>
      </dl>
      <TuitionScholarship contract={contract} />
      <div className={styles.itemsHeader} aria-hidden="true">
        <span>Item</span>
        <span>Pagamento</span>
        <span>Total</span>
      </div>
      <ol aria-label="Itens do contrato">
        {rows.map((row) => (
          <InvoiceItem key={row.id} item={row} />
        ))}
      </ol>
      <InvoiceTotals rows={rows} />
      {reduction > 0 && (
        <p className={styles.note}>Inclui {money(reduction)} em reduções por renegociação.</p>
      )}
    </div>
  );
}

function TuitionScholarship({ contract }: { contract: FinanceContract }): ReactElement | null {
  if (contract.scholarshipPct <= 0) return null;
  return (
    <details className={styles.scholarship}>
      <summary>
        {contract.scholarshipPct === FULL_SCHOLARSHIP_PCT
          ? "Bolsa integral"
          : `Bolsa de ${contract.scholarshipPct.toLocaleString("pt-BR")}%`}
        {" · Mensalidade "}
        {money(contract.monthlyAmountCents ?? 0)}
      </summary>
      <p>Antes da bolsa: {money(contract.baseMonthlyAmountCents ?? 0)}</p>
      <p className="whitespace-pre-wrap">{contract.scholarshipAgreement}</p>
    </details>
  );
}

function InvoiceItem({ item }: { item: FinanceSchedule }): ReactElement {
  return (
    <li className={styles.item}>
      <InvoiceDescription item={item} />
      <InvoiceTerms item={item} />
      <InvoiceValue item={item} />
    </li>
  );
}

function InvoiceDescription({ item }: { item: FinanceSchedule }): ReactElement {
  const status =
    item.material?.scholarshipPct === FULL_SCHOLARSHIP_PCT
      ? { label: "Sem cobrança", variant: "neutral" as const }
      : invoiceItemStatus(item.collection);
  return (
    <div className={styles.description}>
      <h4>{invoiceItemName(item)}</h4>
      <div className={styles.itemStatus}>
        <Badge variant={status.variant}>{status.label}</Badge>
        {item.kind === "TUITION" && item.collection.paidCount > 0 && (
          <span>
            {item.collection.paidCount}/{item.collection.count} pagas
          </span>
        )}
        {item.collection.waivedCount > 0 && <span>{item.collection.waivedCount} dispensadas</span>}
      </div>
      {item.material && item.material.items.length > 1 && (
        <p>{item.material.items.map((book) => book.name).join(" · ")}</p>
      )}
      {item.material && item.material.scholarshipPct > 0 && (
        <details className={styles.scholarship}>
          <summary>
            Bolsa de material: {item.material.scholarshipPct.toLocaleString("pt-BR")}%
          </summary>
          <p className="whitespace-pre-wrap">{item.material.scholarshipAgreement}</p>
        </details>
      )}
    </div>
  );
}

function InvoiceTerms({ item }: { item: FinanceSchedule }): ReactElement {
  const fullScholarship = item.material?.scholarshipPct === FULL_SCHOLARSHIP_PCT;
  const card = item.material?.payment === "INSTALLMENTS" && !fullScholarship;
  return (
    <div className={styles.terms}>
      <p>
        {paymentTerms(item)}
        {card ? " no cartão" : ""}
      </p>
      {card && <span>Repasse integral em até 24h</span>}
      <MaterialDueDate item={item} fullScholarship={fullScholarship} />
      <MaterialCardFee item={item} />
    </div>
  );
}

function MaterialDueDate({
  item,
  fullScholarship,
}: {
  item: FinanceSchedule;
  fullScholarship: boolean;
}): ReactElement | null {
  if (item.kind !== "MATERIAL" || fullScholarship || !item.firstDueDate) return null;
  if (item.collection.balanceCents <= 0) return null;
  return <span>Previsto em {formatDateOnlyBR(item.firstDueDate)}</span>;
}

function MaterialCardFee({ item }: { item: FinanceSchedule }): ReactElement | null {
  if (!item.material || (item.material.cardFeeCents ?? 0) <= 0) return null;
  return (
    <span>
      Taxa {money(item.material.cardFeeCents ?? 0)} · líquido {money(item.totalCents)}
    </span>
  );
}

function InvoiceValue({ item }: { item: FinanceSchedule }): ReactElement {
  return (
    <div className={styles.value}>
      <p>{money(itemAmount(item))}</p>
      {item.collection.receivedCents > 0 && item.collection.balanceCents > 0 && (
        <span>Saldo {money(item.collection.balanceCents)}</span>
      )}
    </div>
  );
}

function InvoiceTotals({ rows }: { rows: FinanceSchedule[] }): ReactElement {
  const gross = rows.reduce((sum, row) => sum + itemAmount(row), 0);
  const fee = rows.reduce((sum, row) => sum + (row.material?.cardFeeCents ?? 0), 0);
  const received = rows.reduce((sum, row) => sum + row.collection.receivedCents, 0);
  const balance = rows.reduce((sum, row) => sum + row.collection.balanceCents, 0);
  return (
    <dl className={styles.totals}>
      <div>
        <dt>Total do contrato</dt>
        <dd>{money(gross)}</dd>
        {fee > 0 && <span>Líquido: {money(gross - fee)}</span>}
      </div>
      <div>
        <dt>Recebido</dt>
        <dd>{money(received)}</dd>
      </div>
      <div>
        <dt>Saldo a receber</dt>
        <dd>{money(balance)}</dd>
      </div>
    </dl>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function invoiceItemName(item: FinanceSchedule): string {
  if (item.kind === "ENROLLMENT_FEE") return "Taxa de matrícula";
  if (item.kind === "OTHER") return "Outra cobrança";
  if (item.kind === "TUITION") return "Mensalidades";
  if (item.material && item.material.items.length > 1) return "Materiais didáticos";
  return item.materialName ?? "Material didático";
}

function invoiceItemStatus(collection: FinanceSchedule["collection"]): {
  label: string;
  variant: "destructive" | "neutral" | "success" | "warning";
} {
  if (collection.overdueCount > 0) return { label: "Em atraso", variant: "destructive" };
  if (collection.balanceCents === 0 && collection.paidCount > 0 && collection.waivedCount > 0)
    return { label: "Sem saldo", variant: "neutral" };
  if (collection.balanceCents === 0 && collection.paidCount > 0)
    return { label: "Quitado", variant: "success" };
  if (collection.balanceCents === 0 && collection.waivedCount > 0)
    return { label: "Dispensado", variant: "neutral" };
  if (collection.receivedCents > 0) return { label: "Parcial", variant: "warning" };
  return { label: "A receber", variant: "neutral" };
}
export function itemAmount(schedule: FinanceSchedule): number {
  return schedule.material?.chargedAmountCents ?? schedule.totalCents;
}
export function paymentTerms(schedule: FinanceSchedule): string {
  const materialValue = schedule.material;
  if (materialValue?.scholarshipPct === FULL_SCHOLARSHIP_PCT)
    return "Bolsa integral · sem cobrança";
  if (typeof materialValue?.chargedAmountCents === "number")
    return materialValue.payment === "INSTALLMENTS"
      ? materialPaymentLabel(materialValue.chargedAmountCents, materialValue.quotedInstallments)
      : `${money(materialValue.chargedAmountCents)} à vista`;
  return schedule.uniformAmountCents === null
    ? "Parcelas com valores variáveis"
    : `${schedule.installmentCount} × ${money(schedule.uniformAmountCents)}`;
}
