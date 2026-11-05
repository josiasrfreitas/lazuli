import type { Prisma } from "@lazuli/db";
import { createHash } from "node:crypto";
import {
  quoteSettlement,
  settlementInterestDetails,
  saoPauloDateOnly,
  type SettlementInput,
  type SettlementQuote,
} from "@lazuli/domain";
import { badRequest } from "../../trpc/errors.js";
import { type FinanceDatabase, toDateOnlyString } from "./shared.js";

const settlementInclude = {
  agreements: { orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }, { id: "asc" }] },
  order: { include: { contract: true, material: true } },
  adjustments: { where: { deletedAt: null }, orderBy: { id: "asc" } },
  allocations: {
    where: { deletedAt: null, paymentEntry: { deletedAt: null } },
    include: {
      paymentEntry: true,
      reversals: {
        where: { deletedAt: null, reversal: { deletedAt: null } },
        include: { reversal: { select: { kind: true, occurredOn: true, createdAt: true } } },
      },
    },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.InstallmentInclude;
export type SettlementItem = Prisma.InstallmentGetPayload<{ include: typeof settlementInclude }>;
export async function loadSettlementItems(
  database: Pick<FinanceDatabase, "installment">,
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
  interestDetails?: ReturnType<typeof settlementInterestDetails>;
  materialReceipt?: { name: string; chargedCents: number; feeCents: number; netCents: number };
};

export function settlementLine(input: {
  item: SettlementItem;
  date: string;
  amountCents?: number | undefined;
  now: Date;
}): SettlementLine {
  const { item, date } = input;
  validateSettlementItem(input);
  const contract = item.order.kind === "TUITION" ? item.order.contract : null;
  const calculation: SettlementInput = {
    nominalCents: item.amountCents,
    terms: settlementTerms(item),
    payments: item.allocations.map((row) => ({
      date: toDateOnlyString(row.paymentEntry.date),
      amountCents:
        row.amountCents -
        row.reversals
          .filter((line) => line.reversal.kind === "CANCELLATION")
          .reduce((sum, line) => sum + line.amountCents, 0),
      recordedAt: row.paymentEntry.createdAt.toISOString(),
    })),
    refunds: item.allocations.flatMap((row) =>
      row.reversals
        .filter((line) => line.reversal.kind === "REFUND")
        .map((line) => ({
          date: toDateOnlyString(line.reversal.occurredOn),
          amountCents: line.amountCents,
          recordedAt: line.reversal.createdAt.toISOString(),
        })),
    ),
    ...settlementFacts(item),
    postedInterestCents: item.adjustments
      .filter((row) => contract && row.type === "INTEREST")
      .reduce((sum, row) => sum + row.amountCents, 0),
    effectiveDate: date,
    receivedCents: input.amountCents,
  };
  const quote = quoteSettlement(calculation);
  return {
    installmentId: item.id,
    payerId: item.order.contract?.payerId ?? item.order.payerId ?? "",
    version: createHash("sha256").update(JSON.stringify({ item, date })).digest("hex"),
    quote,
    ...(quote.newInterestCents > 0
      ? { interestDetails: settlementInterestDetails(calculation) }
      : {}),
    ...materialReceipt(item),
  };
}

function settlementFacts(
  item: SettlementItem,
): Pick<
  import("@lazuli/domain").SettlementInput,
  "principalAdjustments" | "suspensions" | "chargeAdjustments"
> {
  const contract = item.order.kind === "TUITION" ? item.order.contract : null;
  return {
    principalAdjustments: item.adjustments
      .filter((row) => row.type !== "INTEREST" && row.type !== "LATE_FEE" && !row.chargeOnly)
      .map((row) => ({
        date: row.effectiveDate
          ? toDateOnlyString(row.effectiveDate)
          : saoPauloDateOnly(row.createdAt),
        amountCents: row.amountCents,
        recordedAt: row.createdAt.toISOString(),
      })),
    suspensions: item.agreements.flatMap((row) =>
      row.newDueDate === null
        ? []
        : [
            {
              date: toDateOnlyString(row.effectiveDate),
              recordedAt: row.createdAt.toISOString(),
              newDueDate: toDateOnlyString(row.newDueDate),
            },
          ],
    ),
    chargeAdjustments: item.adjustments
      .filter(
        (row) =>
          row.chargeOnly || row.type === "LATE_FEE" || (!contract && row.type === "INTEREST"),
      )
      .map((row) => ({
        date: row.effectiveDate
          ? toDateOnlyString(row.effectiveDate)
          : saoPauloDateOnly(row.createdAt),
        amountCents: row.amountCents,
        recordedAt: row.createdAt.toISOString(),
      })),
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
  const laterRefund = item.allocations.some((row) =>
    row.reversals.some(
      (line) =>
        line.reversal.kind === "REFUND" && toDateOnlyString(line.reversal.occurredOn) > date,
    ),
  );
  const laterAdjustment = item.adjustments.some(
    (row) =>
      (row.effectiveDate ? toDateOnlyString(row.effectiveDate) : saoPauloDateOnly(row.createdAt)) >
      date,
  );
  const laterAgreement = item.agreements.some((row) => toDateOnlyString(row.effectiveDate) > date);
  if (laterPayment || laterRefund || laterAdjustment || laterAgreement)
    throw badRequest(`Parcela ${item.sequenceNumber}: data anterior a fato já efetivado.`);
  assertContractRates(item);
}

function assertContractRates(item: SettlementItem): void {
  if (item.order.contract?.deletedAt) throw badRequest("Contrato indisponível para pagamento.");
  if (
    item.order.contract &&
    (item.order.contract.punctualityDiscountPct === null ||
      item.order.contract.interestRatePctMonthly === null)
  ) {
    throw badRequest("Contrato sem condições de juros definidas.");
  }
}

function settlementTerms(item: SettlementItem): {
  dueDate: string;
  monthlyPct: number;
  discountPct: number;
} {
  const contract = item.order.kind === "TUITION" ? item.order.contract : null;
  if (!contract)
    return {
      dueDate: toDateOnlyString(item.agreements[0]?.previousDueDate ?? item.dueDate),
      monthlyPct: 0,
      discountPct: 0,
    };
  return {
    dueDate: toDateOnlyString(item.agreements[0]?.previousDueDate ?? item.dueDate),
    monthlyPct: decimalRate(contract.interestRatePctMonthly),
    discountPct: decimalRate(contract.punctualityDiscountPct),
  };
}

function decimalRate(value: Prisma.Decimal | null): number {
  return value?.toNumber() ?? 0;
}

function materialReceipt(item: SettlementItem): Pick<SettlementLine, "materialReceipt"> {
  const material = item.order.material;
  if (material === null || material.chargedAmountCents === null) return {};
  return {
    materialReceipt: {
      name: material.name,
      chargedCents: material.chargedAmountCents,
      feeCents: material.cardFeeCents ?? 0,
      netCents: item.order.principalAmountCents,
    },
  };
}
