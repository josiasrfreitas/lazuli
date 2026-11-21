import assert from "node:assert/strict";
import { it } from "node:test";
import { parseReceipt } from "../../src/features/installments/payment/receipt-fields.js";
import { withReceiptFields } from "../../src/features/installments/payment/with-receipt-fields.js";
import { PAYMENT_DRAFT } from "../support/payment-draft.js";

void it("selects the paid amount and transaction date among boleto fields", () => {
  assert.deepEqual(
    parseReceipt(
      "Vencimento: 20/11/2026\nValor: 1.300,00\nData do pagamento\n18 de novembro de 2026 às 13:45\nValor pago\nR$ 1.234,56",
    ),
    { date: "18/11/2026", cents: 123456 },
  );
});
void it("omits conflicting amounts and impossible or scheduled dates", () => {
  assert.deepEqual(parseReceipt("Valor pago: 12,00\nValor pago: 15,00\nData: 31/04/2026"), {});
  assert.deepEqual(parseReceipt("Pagamento agendado\nValor: 12,00\nData: 28/04/2026"), {});
});
void it("preserves manual fields and does not allocate a shared receipt", () => {
  const proofs = {
    "receipt-one": {
      id: "proof",
      file: undefined,
      error: "",
      fields: { date: "18/11/2026", cents: 12345 },
    },
  };
  const item = PAYMENT_DRAFT.items[0]!;
  const single = withReceiptFields(PAYMENT_DRAFT, proofs);
  assert.equal(single.items[0]?.amount, 12345);
  assert.equal(single.date, "18/11/2026");
  const edited = withReceiptFields(
    { ...PAYMENT_DRAFT, dateEdited: true, items: [item, { ...item, amount: 500 }] },
    proofs,
  );
  assert.equal(edited.date, PAYMENT_DRAFT.date);
  assert.deepEqual(
    edited.items.map((row) => row.amount),
    [undefined, 500],
  );
});
