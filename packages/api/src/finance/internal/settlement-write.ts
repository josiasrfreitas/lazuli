import type { SettlementLine } from "./settlement-data.js";
import { badRequest } from "../../trpc/errors.js";
import { type FinanceDatabase, toDateOnly } from "./shared.js";

export function assertReceivablePayment(line: SettlementLine): void {
  const { quote } = line;
  if (quote.receivedCents <= 0 || quote.settlementCents <= 0 || quote.remainingCents < 0) {
    throw badRequest(
      `Parcela ${line.installmentId}: valor deve ser positivo e não exceder a quitação.`,
    );
  }
}

export async function persistSettlementAdjustments(input: {
  database: FinanceDatabase;
  staffUserId: string;
  date: string;
  lines: SettlementLine[];
}): Promise<void> {
  for (const line of input.lines) {
    const adjustments = [
      {
        type: "INTEREST" as const,
        amountCents: line.quote.newInterestCents,
        reason: "Juros contratuais",
      },
      {
        type: "DISCOUNT" as const,
        amountCents: -line.quote.discountCents,
        reason: "Pontualidade contratual",
      },
    ];
    for (const adjustment of adjustments) {
      if (adjustment.amountCents === 0) continue;
      await input.database.installmentAdjustment.create({
        data: {
          ...adjustment,
          installmentId: line.installmentId,
          effectiveDate: toDateOnly(input.date),
          createdById: input.staffUserId,
          updatedById: input.staffUserId,
        },
      });
    }
  }
}
