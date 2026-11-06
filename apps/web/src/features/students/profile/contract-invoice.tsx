import { useState, type ReactElement } from "react";
import { ChevronRight } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { Badge } from "@lazuli/ui";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import { materialPaymentLabel } from "~/features/contracts/material-payment-label";
import { InvoiceTotals } from "./contract-invoice-totals";
import { ContractInstallments } from "./contract-installments";
import styles from "./contract-invoice.module.css";

export type FinanceContract = RouterOutputs["finance"]["studentSummary"]["contracts"][number];
export type FinanceSchedule = FinanceContract["schedules"][number];
const FULL_SCHOLARSHIP_PCT = 100;

export function ContractInvoice({ contract }: { contract: FinanceContract }): ReactElement {
  const rows = [...contract.schedules].toSorted(
    (left, right) => Number(right.kind === "TUITION") - Number(left.kind === "TUITION"),
  );
  const reduction = contract.renegotiations?.reduce((sum, row) => sum + row.reductionCents, 0) ?? 0;
  return (
    <div className={styles.container}>
      <div className={styles.itemsHeader} aria-hidden="true">
        <span>Item</span>
        <span>Condição de pagamento</span>
        <span>Valor contratado</span>
      </div>
      <ol aria-label="Itens do contrato">
        {rows.map((row) => (
          <InvoiceItem key={row.id} item={row} payerName={contract.payerName} />
        ))}
      </ol>
      <div className={styles.closing}>
        <div className={styles.conditions}>
          <TuitionScholarship contract={contract} />
          {contract.punctualityDiscountPct > 0 && (
            <p>
              <strong>Pontualidade</strong>
              <br />
              {contract.punctualityDiscountPct.toLocaleString("pt-BR")}% de desconto nas
              mensalidades pagas até o vencimento.
            </p>
          )}
          {reduction > 0 && (
            <p>O valor contratado já inclui {money(reduction)} em reduções por renegociação.</p>
          )}
        </div>
        <InvoiceTotals rows={rows} tuition={contract} />
      </div>
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

function InvoiceItem({
  item,
  payerName,
}: {
  item: FinanceSchedule;
  payerName: string;
}): ReactElement {
  if (item.kind === "TUITION") return <TuitionItem item={item} payerName={payerName} />;
  return (
    <li className={styles.item}>
      <InvoiceDescription item={item} />
      <InvoiceTerms item={item} />
      <InvoiceValue item={item} />
    </li>
  );
}

function TuitionItem({
  item,
  payerName,
}: {
  item: FinanceSchedule;
  payerName: string;
}): ReactElement {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className={styles.expandableItem}>
      <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary className={styles.item}>
          <InvoiceDescription item={item} />
          <InvoiceTerms item={item} />
          <InvoiceValue item={item} />
        </summary>
        {expanded && <ContractInstallments orderId={item.id} payerName={payerName} />}
      </details>
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
      <div className={styles.itemTitle}>
        <h4>{invoiceItemName(item)}</h4>
        {item.kind === "TUITION" && <ChevronRight aria-hidden="true" className={styles.chevron} />}
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      <ItemCollection item={item} />
      {item.material && item.material.items.length > 1 && (
        <p>{item.material.items.map((book) => book.name).join(" · ")}</p>
      )}
      {item.material && item.material.scholarshipPct > 0 && (
        <details className={styles.scholarship}>
          <summary>
            Bolsa de material: {item.material.scholarshipPct.toLocaleString("pt-BR")}%
          </summary>
          <p className="whitespace-pre-wrap">
            {item.material.scholarshipAgreement || "Bolsa aplicada ao material didático."}
          </p>
        </details>
      )}
    </div>
  );
}

function ItemCollection({ item }: { item: FinanceSchedule }): ReactElement | null {
  const { paidCount, waivedCount, count } = item.collection;
  const showPaid = item.kind === "TUITION" && paidCount > 0;
  if (!showPaid && waivedCount === 0) return null;
  return (
    <div className={styles.itemStatus}>
      {showPaid && (
        <span>
          {paidCount} de {count} parcelas pagas
        </span>
      )}
      {waivedCount > 0 && <span>{waivedCount} dispensadas</span>}
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
      {card && <span>Recebimento único pela escola</span>}
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
      {item.material && item.material.listPriceCents > itemAmount(item) && (
        <s
          className={styles.originalValue}
          aria-label={`Valor integral do material: ${money(item.material.listPriceCents)}`}
        >
          {money(item.material.listPriceCents)}
        </s>
      )}
      <p>{money(itemAmount(item))}</p>
      {item.collection.receivedCents > 0 && item.collection.balanceCents > 0 && (
        <span>A receber: {money(item.collection.balanceCents)}</span>
      )}
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
  if (materialValue?.scholarshipPct === FULL_SCHOLARSHIP_PCT) return "Bolsa integral";
  if (typeof materialValue?.chargedAmountCents === "number")
    return materialValue.payment === "INSTALLMENTS"
      ? materialPaymentLabel(materialValue.chargedAmountCents, materialValue.quotedInstallments)
      : `${money(materialValue.chargedAmountCents)} à vista`;
  return schedule.uniformAmountCents === null
    ? "Parcelas com valores variáveis"
    : `${schedule.installmentCount} × ${money(schedule.uniformAmountCents)}`;
}
