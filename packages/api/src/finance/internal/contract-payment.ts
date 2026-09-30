import type { RegisterPaymentInput } from "./register-payment.js";
import { loadSettlementItems, settlementLine, type SettlementLine } from "./settlement-data.js";
import { assertReceivablePayment } from "./settlement-write.js";
import {
  badRequest,
  CONTRACT_PAYMENT_COMMAND_REQUIRED_MESSAGE,
  toDateOnlyString,
  type FinanceDatabase,
} from "./shared.js";

export async function prepareContractPayment(input: {
  database: FinanceDatabase;
  values: RegisterPaymentInput;
  now: Date;
}): Promise<SettlementLine[]> {
  const items = await loadSettlementItems(
    input.database,
    input.values.allocations.map((row) => row.installmentId),
  );
  const contractual = items.filter((item) => item.order.contract !== null);
  if (contractual.length === 0) return [];
  if (!input.values.commandId) throw badRequest(CONTRACT_PAYMENT_COMMAND_REQUIRED_MESSAGE);
  const allocated = input.values.allocations.reduce((sum, row) => sum + row.amountCents, 0);
  if (allocated !== input.values.amountCents)
    throw badRequest("Total recebido deve coincidir com as alocações.");
  return contractual.map((item) => {
    const amountCents = input.values.allocations
      .filter((row) => row.installmentId === item.id)
      .reduce((sum, row) => sum + row.amountCents, 0);
    const line = settlementLine({
      item,
      date: toDateOnlyString(input.values.date),
      amountCents,
      now: input.now,
    });
    assertReceivablePayment(line);
    return line;
  });
}
