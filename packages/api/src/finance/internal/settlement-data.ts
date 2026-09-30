import type { Prisma } from "@lazuli/db";
import { createHash } from "node:crypto";
import { quoteSettlement, saoPauloDateOnly, type SettlementQuote } from "@lazuli/domain";
import { badRequest, type FinanceDatabase, toDateOnlyString } from "./shared.js";

const settlementInclude = {
  order: { include: { contract: true } },
  adjustments: { orderBy: { id: "asc" } },
  allocations: { include: { paymentEntry: true }, orderBy: { id: "asc" } },
} satisfies Prisma.InstallmentInclude;
export type SettlementItem = Prisma.InstallmentGetPayload<{ include: typeof settlementInclude }>;
export async function loadSettlementItems(
  database: FinanceDatabase,
  ids: string[],
): Promise<SettlementItem[]> {
  return database.installment.findMany({
    where: { id: { in: ids } },
    include: settlementInclude,
  });
}
export type SettlementLine = {
  installmentId: string;
  payerId: string;
  version: string;
  quote: SettlementQuote;
};

export function settlementLine(input: {
  item: SettlementItem;
  date: string;
  amountCents?: number | undefined;
  now: Date;
}): SettlementLine {
  const { item, date } = input;
  validateSettlementItem(input);
  const contract = item.order.contract;
  const quote = quoteSettlement({
    nominalCents: item.amountCents,
    terms: settlementTerms(item),
    payments: item.allocations.map((row) => ({
      date: toDateOnlyString(row.paymentEntry.date),
      amountCents: row.amountCents,
    })),
    adjustmentCents: item.adjustments.reduce((sum, row) => sum + row.amountCents, 0),
    postedInterestCents: item.adjustments
      .filter((row) => row.type === "INTEREST")
      .reduce((sum, row) => sum + row.amountCents, 0),
    effectiveDate: date,
    receivedCents: input.amountCents,
  });
  return {
    installmentId: item.id,
    payerId: contract?.payerId ?? item.order.payerId ?? "",
    version: createHash("sha256").update(JSON.stringify({ item, date })).digest("hex"),
    quote,
  };
}

function validateSettlementItem(input: { item: SettlementItem; date: string; now: Date }): void {
  const { item, date } = input;
  const invalid = item.deletedAt || item.waivedAt || item.order.cancelledAt || item.order.deletedAt;
  if (invalid) throw badRequest(`Parcela ${item.sequenceNumber}: indisponível para pagamento.`);
  if (date > saoPauloDateOnly(input.now)) throw badRequest("Data futura não é permitida.");
  const laterPayment = item.allocations.some(
    (row) => toDateOnlyString(row.paymentEntry.date) > date,
  );
  const laterAdjustment = item.adjustments.some(
    (row) => toDateOnlyString(row.effectiveDate ?? row.createdAt) > date,
  );
  if (laterPayment || laterAdjustment)
    throw badRequest(`Parcela ${item.sequenceNumber}: data anterior a fato já efetivado.`);
  assertContractRates(item);
}

function assertContractRates(item: SettlementItem): void {
  if (
    item.order.contract &&
    (item.order.contract.interestRatePctDaily === null ||
      item.order.contract.interestRatePctMonthly === null)
  ) {
    throw badRequest("Contrato sem condições de juros definidas.");
  }
}

function settlementTerms(item: SettlementItem): {
  dueDate: string;
  dailyPct: number;
  monthlyPct: number;
  discountPct: number;
} {
  const contract = item.order.contract;
  return {
    dueDate: toDateOnlyString(item.dueDate),
    dailyPct: contract?.interestRatePctDaily?.toNumber() ?? 0,
    monthlyPct: contract?.interestRatePctMonthly?.toNumber() ?? 0,
    discountPct: contract?.punctualityDiscountPct?.toNumber() ?? 0,
  };
}
