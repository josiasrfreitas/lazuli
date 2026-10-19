import { deriveInstallmentLedger } from "@lazuli/domain";
import { TRPCError } from "@trpc/server";
import { contractSelect, toRow } from "./contracts-select.js";
import { toDateOnlyString, type FinanceDatabase } from "./shared.js";

export async function readContract(database: FinanceDatabase, id: string, now: Date) {
  const contract = await database.contract.findFirst({
    where: { id, deletedAt: null, commandId: { not: null } },
    select: { ...contractSelect, punctualityDiscountPct: true },
  });
  if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "Contrato não encontrado." });
  const calendar = new Map<
    string,
    {
      dueDate: string;
      tuitionCents: number;
      materialCents: number;
      otherCents: number;
      balanceCents: number;
      paidCents: number;
    }
  >();
  const orders = contract.orders.map((order) => {
    const installments = order.installments.map((entry) => {
      const ledger = deriveInstallmentLedger({
        ...entry,
        orderCancelledAt: order.cancelledAt,
        now,
        interestRatePctMonthly: 0,
      });
      const dueDate = toDateOnlyString(entry.dueDate);
      const row = calendar.get(dueDate) ?? {
        dueDate,
        tuitionCents: 0,
        materialCents: 0,
        otherCents: 0,
        balanceCents: 0,
        paidCents: 0,
      };
      if (!order.cancelledAt) {
        row[
          order.kind === "TUITION"
            ? "tuitionCents"
            : order.kind === "MATERIAL"
              ? "materialCents"
              : "otherCents"
        ] += entry.amountCents;
        row.balanceCents += ledger.collectibleRemainingCents;
        row.paidCents += ledger.paidAmountCents;
        calendar.set(dueDate, row);
      }
      return {
        id: entry.id,
        sequence: entry.sequenceNumber,
        dueDate,
        amountCents: entry.amountCents,
        balanceCents: ledger.collectibleRemainingCents,
        paidCents: ledger.paidAmountCents,
        status: ledger.status,
      };
    });
    return {
      id: order.id,
      kind: order.kind,
      cancelled: Boolean(order.cancelledAt),
      totalCents: order.principalAmountCents,
      material: order.material
        ? {
            name: order.material.name,
            items: order.material.items,
            stageId: order.material.stageId,
            stageCode: order.material.stageCode,
            category: order.material.category,
            payment: order.material.payment,
            listPriceCents: order.material.listPriceCents,
            cashDiscountPct: Number(order.material.cashDiscountPct),
            chargedAmountCents: order.material.chargedAmountCents,
            cardFeePct:
              order.material.cardFeePct === null ? null : Number(order.material.cardFeePct),
            cardFeeCents: order.material.cardFeeCents,
            quotedInstallments: order.material.quotedInstallments,
            quotedInstallmentCents: order.material.quotedInstallmentCents,
          }
        : null,
      installments,
    };
  });
  return {
    ...toRow(contract, now),
    punctualityDiscountPct: Number(contract.punctualityDiscountPct),
    terminated: Boolean(contract.terminatedAt),
    orders,
    calendar: [...calendar.values()]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((row) => ({ ...row, id: row.dueDate })),
  };
}
