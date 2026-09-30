import assert from "node:assert/strict";
import { it } from "node:test";
import {
  draftReceipts,
  paymentDraftError,
  paymentDraftReducer,
} from "../../src/features/installments/payment/draft.js";
import {
  toggleSelected,
  toggleVisibleSelection,
} from "../../src/features/installments/payment/selection.js";
import { PAYMENT_DRAFT, PAYMENT_PREVIEW, PAYMENT_ROW } from "../support/payment-draft.js";
void it("keeps edited amounts when adding and removing other items and separates receipt identities explicitly", () => {
  const second = { ...PAYMENT_ROW, installmentId: "second", sequenceNumber: 2 };
  const edited = paymentDraftReducer(PAYMENT_DRAFT, {
    type: "amount",
    id: PAYMENT_ROW.installmentId,
    value: 10_000,
  });
  const added = paymentDraftReducer(edited, { type: "add", row: second, receiptId: "ignored" });
  assert.equal(added.items[0]?.amount, 10_000);
  assert.equal(added.items[1]?.receiptId, "receipt-one");
  const split = paymentDraftReducer(added, {
    type: "split",
    id: second.installmentId,
    receiptId: "receipt-two",
  });
  assert.deepEqual(
    draftReceipts(split, PAYMENT_PREVIEW).map((receipt) => receipt.commandId),
    ["receipt-one", "receipt-two"],
  );
  const removed = paymentDraftReducer(split, { type: "remove", id: second.installmentId });
  assert.deepEqual(removed.items, edited.items);
});
void it("rejects missing previews, invalid values and a total that differs from explicit allocations", () => {
  assert.equal(paymentDraftError(PAYMENT_DRAFT, PAYMENT_PREVIEW), null);
  assert.match(paymentDraftError(PAYMENT_DRAFT, []) ?? "", /Aguarde a prévia/);
  const missing = paymentDraftReducer(PAYMENT_DRAFT, {
    type: "amount",
    id: PAYMENT_ROW.installmentId,
    value: null,
  });
  assert.match(paymentDraftError(missing, PAYMENT_PREVIEW) ?? "", /positivo/);
  const over = paymentDraftReducer(PAYMENT_DRAFT, {
    type: "amount",
    id: PAYMENT_ROW.installmentId,
    value: 25_000,
  });
  assert.match(paymentDraftError(over, PAYMENT_PREVIEW) ?? "", /até a quitação/);
  const mismatch = paymentDraftReducer(PAYMENT_DRAFT, {
    type: "total",
    id: "receipt-one",
    value: 22_000,
  });
  assert.match(paymentDraftError(mismatch, PAYMENT_PREVIEW) ?? "", /total recebido/);
  assert.equal(draftReceipts(PAYMENT_DRAFT, PAYMENT_PREVIEW)[0]?.amountCents, 23_000);
});
void it("selects only visible eligible rows and preserves selections outside the current page or filter", () => {
  const outside = { ...PAYMENT_ROW, installmentId: "outside" };
  const paid = { ...PAYMENT_ROW, installmentId: "paid", collectibleBalanceCents: 0 };
  const added = toggleVisibleSelection([outside], [PAYMENT_ROW, paid]);
  assert.deepEqual(
    added.map((row) => row.installmentId),
    ["outside", PAYMENT_ROW.installmentId],
  );
  assert.deepEqual(toggleVisibleSelection(added, [PAYMENT_ROW, paid]), [outside]);
  assert.deepEqual(toggleSelected([outside], paid), [outside]);
});
