import { TRPCError } from "@trpc/server";
import type { PaymentPreviewInput } from "@lazuli/validators";
import { loadSettlementItems, settlementLine, type SettlementLine } from "./settlement-data.js";
import type { FinanceDatabase } from "./shared.js";

export type PaymentPreviewRow = {
  installmentId: string;
  line: SettlementLine | null;
  error: string | null;
};
export async function previewPayments(input: {
  database: FinanceDatabase;
  values: PaymentPreviewInput;
  now: Date;
}): Promise<PaymentPreviewRow[]> {
  const items = await loadSettlementItems(
    input.database,
    input.values.items.map((row) => row.installmentId),
  );
  return input.values.items.map((row) => {
    const item = items.find((entry) => entry.id === row.installmentId);
    if (!item)
      return { installmentId: row.installmentId, line: null, error: "Parcela não encontrada." };
    try {
      return {
        installmentId: item.id,
        line: settlementLine({
          item,
          date: input.values.date,
          amountCents: row.amountCents,
          now: input.now,
        }),
        error: null,
      };
    } catch (error) {
      if (!(error instanceof TRPCError)) throw error;
      return { installmentId: item.id, line: null, error: error.message };
    }
  });
}
