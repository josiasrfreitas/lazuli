import assert from "node:assert/strict";
import { it } from "node:test";
import {
  draftReceipts,
  paymentDraftError,
  paymentDraftReducer,
  receiptInstallmentCount,
  type PaymentDraft,
} from "../../src/features/installments/payment/draft.js";
import {
  toggleSelected,
  toggleVisibleSelection,
} from "../../src/features/installments/payment/selection.js";
import { PAYMENT_DRAFT, PAYMENT_PREVIEW, PAYMENT_ROW } from "../support/payment-draft.js";
void it("records the bank plan as receipt metadata without splitting the school payment", () => {
  const material = {
    ...PAYMENT_ROW,
    origin: "MATERIAL" as const,
    scheduleTotal: 1,
    material: {
      name: "Essentials 1 + Essentials 2",
      payment: "INSTALLMENTS" as const,
      installmentCount: 6,
    },
  };
  let draft: PaymentDraft = {
    ...PAYMENT_DRAFT,
    items: [{ ...PAYMENT_DRAFT.items[0]!, row: material }],
  };
  assert.equal(receiptInstallmentCount(draft, "receipt-one"), "6");
  draft = paymentDraftReducer(draft, { type: "method", value: "CREDIT", externalFinancing: true });
  const receipts = draftReceipts(draft, PAYMENT_PREVIEW);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0]?.externalInstallments, 6);
  assert.equal(receipts[0]?.amountCents, 23000);
  assert.equal(receipts[0]?.allocations.length, 1);
  const invalid = paymentDraftReducer(draft, {
    type: "externalInstallments",
    id: "receipt-one",
    value: "0",
  });
  assert.match(paymentDraftError(invalid, PAYMENT_PREVIEW) ?? "", /parcelas no banco/);
  const cash = paymentDraftReducer(draft, { type: "method", value: "CASH" });
  assert.equal(draftReceipts(cash, PAYMENT_PREVIEW)[0]?.externalInstallments, undefined);
});
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
void it("puts a third-party name on the Pix receipt only", () => {
  const named = paymentDraftReducer(PAYMENT_DRAFT, {
    type: "thirdPartyName",
    id: "receipt-one",
    value: "  Marina Ribeiro  ",
  });
  assert.equal(draftReceipts(named, PAYMENT_PREVIEW)[0]?.thirdPartyName, "Marina Ribeiro");
  const cash = paymentDraftReducer(named, { type: "method", value: "CASH" });
  assert.equal(draftReceipts(cash, PAYMENT_PREVIEW)[0]?.thirdPartyName, undefined);
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
