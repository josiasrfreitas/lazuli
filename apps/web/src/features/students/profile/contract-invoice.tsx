import type { ReactElement, ReactNode } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Badge } from "@lazuli/ui";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import styles from "./contract-invoice.module.css";
export type FinanceContract = RouterOutputs["finance"]["studentSummary"]["contracts"][number];
export type FinanceSchedule = FinanceContract["schedules"][number];

export function ContractInvoice({ contract }: { contract: FinanceContract }): ReactElement {
  const rows = [...contract.schedules].toSorted(
    (left, right) => Number(right.kind === "TUITION") - Number(left.kind === "TUITION"),
  );
  const tuition = rows.find((row) => row.kind === "TUITION");
  const gross = rows.reduce((sum, row) => sum + itemAmount(row), 0);
  const fee = rows.reduce((sum, row) => sum + (row.material?.cardFeeCents ?? 0), 0);
  const received = rows.reduce((sum, row) => sum + row.collection.receivedCents, 0);
  const balance = rows.reduce((sum, row) => sum + row.collection.balanceCents, 0);
  return (
    <>
      <dl className={styles.meta}>
        <Meta label="Vigência">
          {contract.startsOn && contract.endsOn
            ? `${formatDateOnlyBR(contract.startsOn)} a ${formatDateOnlyBR(contract.endsOn)}`
            : "Não informada"}
        </Meta>
        <Meta label="Pagador">{contract.payerName}</Meta>
        <Meta label="Vencimento">{tuition ? `Todo dia ${tuition.dueDay}` : "—"}</Meta>
      </dl>
      <div className={styles.itemsHeader} aria-hidden="true">
        <span>Itens do contrato</span>
        <span className="text-right">Valor do aluno</span>
        <span className="text-right">Recebimento</span>
      </div>
      <ol aria-label="Itens do contrato">
        {rows.map((row) => (
          <InvoiceItem key={row.id} item={row} />
        ))}
      </ol>
      <div className={styles.bottom}>
        <div className="grid content-start gap-2 text-caption text-muted-foreground">
          {rows.some((row) => row.material?.payment === "INSTALLMENTS") ? (
            <p>
              Material no cartão: o parcelamento é do banco. A escola recebe o líquido em até 24h
              após a venda.
            </p>
          ) : (
            <p>Os pagamentos são registrados conforme o recebimento.</p>
          )}
        </div>
        <dl className={styles.totals}>
          <Total label="Valor dos itens" cents={gross} />
          {fee > 0 && <Total label="Taxa do cartão" cents={-fee} />}
          <Total label="Líquido para a escola" cents={gross - fee} />
          <Total label="Já recebido" cents={received} />
          <div className={styles.balance}>
            <dt className="text-sm font-medium">Saldo a receber</dt>
            <dd className="font-numeric text-2xl font-semibold tracking-tight tabular-nums text-heading">
              {money(balance)}
            </dd>
          </div>
        </dl>
      </div>
    </>
  );
}
function InvoiceItem({ item }: { item: FinanceSchedule }): ReactElement {
  const collectionValue = item.collection;
  const status =
    collectionValue.overdueCount > 0
      ? { label: "Em atraso", variant: "destructive" as const }
      : collectionValue.balanceCents === 0 &&
          collectionValue.paidCount > 0 &&
          collectionValue.waivedCount > 0
        ? { label: "Sem saldo", variant: "neutral" as const }
        : collectionValue.balanceCents === 0 && collectionValue.paidCount > 0
          ? { label: "Quitado", variant: "success" as const }
          : collectionValue.balanceCents === 0 && collectionValue.waivedCount > 0
            ? { label: "Dispensado", variant: "neutral" as const }
            : collectionValue.receivedCents > 0
              ? { label: "Parcial", variant: "warning" as const }
              : { label: "A receber", variant: "neutral" as const };
  const card =
    item.material?.payment === "INSTALLMENTS" && item.material.chargedAmountCents != null;
  return (
    <li className={styles.item}>
      <div className="min-w-0">
        <h3 className={styles.itemName}>
          {item.kind === "MATERIAL"
            ? item.material && item.material.items.length > 1
              ? "Materiais didáticos"
              : (item.materialName ?? "Material didático")
            : "Mensalidade do curso"}
        </h3>
        <div className={styles.itemDetail}>
          {item.material && item.material.items.length > 1 && (
            <ul
              aria-label="Livros desta venda"
              className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground"
            >
              {item.material.items.map((book) => (
                <li key={book.stageId}>{book.name}</li>
              ))}
            </ul>
          )}
          <p className="font-numeric text-sm tabular-nums">
            {paymentTerms(item)}
            {card && " no cartão"}
          </p>
          {item.kind === "MATERIAL" && item.firstDueDate && (
            <p className="text-muted-foreground">
              Recebimento único
              {collectionValue.balanceCents > 0 &&
                ` · previsto para ${formatDateOnlyBR(item.firstDueDate)}`}
            </p>
          )}
        </div>
      </div>
      <div className={styles.value}>
        <p className={styles.itemAmount}>
          <span className="sr-only">Valor do aluno: </span>
          {money(itemAmount(item))}
        </p>
        {card && (
          <p className="text-caption text-muted-foreground">
            Taxa {item.material?.cardFeePct?.toLocaleString("pt-BR")}% ·{" "}
            {money(item.material?.cardFeeCents ?? 0)}
            <br />
            Líquido {money(item.totalCents)}
          </p>
        )}
      </div>
      <div className={styles.settlement}>
        <Badge variant={status.variant}>{status.label}</Badge>
        <div className="grid gap-1 text-caption text-muted-foreground">
          <p>
            {item.kind === "TUITION"
              ? collectionValue.waivedCount > 0
                ? `${collectionValue.paidCount} pagas · ${collectionValue.waivedCount} dispensadas`
                : `${collectionValue.paidCount} de ${collectionValue.count} mensalidades pagas`
              : `${money(collectionValue.receivedCents)} recebido`}
          </p>
          {collectionValue.balanceCents > 0 && (
            <p className="font-numeric text-sm tabular-nums">
              Saldo {money(collectionValue.balanceCents)}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
function Meta({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div>
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-caption text-muted-foreground">{children}</dd>
    </div>
  );
}
function Total({ label, cents }: { label: string; cents: number }): ReactElement {
  return (
    <div className={styles.totalRow}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={styles.amount}>{money(cents)}</dd>
    </div>
  );
}
export function itemAmount(schedule: FinanceSchedule): number {
  return schedule.material?.chargedAmountCents ?? schedule.totalCents;
}
export function paymentTerms(schedule: FinanceSchedule): string {
  const materialValue = schedule.material;
  if (materialValue?.chargedAmountCents != null)
    return materialValue.payment === "INSTALLMENTS"
      ? `${materialValue.quotedInstallments} × ${money(materialValue.quotedInstallmentCents)}`
      : `${money(materialValue.chargedAmountCents)} à vista`;
  return schedule.uniformAmountCents === null
    ? "Parcelas com valores variáveis"
    : `${schedule.installmentCount} × ${money(schedule.uniformAmountCents)}`;
}
