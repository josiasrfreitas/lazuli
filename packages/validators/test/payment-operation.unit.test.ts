import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paymentOperationSchema } from "../src/payment-operation.js";

const command = {
  operationId: "7496daba-371d-4eec-b980-138d314ed34d",
  date: "2026-10-28",
  method: "PIX",
  receipts: [
    {
      commandId: "7e6f33af-cb96-4c78-8917-bced0ea724f9",
      payerId: "243776f4-5eec-4c7f-b0bb-a7a437500b78",
      amountCents: 1000,
      allocations: [
        {
          installmentId: "e59291db-6c30-490b-9a11-dc19ca205da2",
          amountCents: 1000,
          version: "v1",
        },
      ],
    },
  ],
};

void describe("third-party payment name", () => {
  void it("normalizes a Pix name for the receipt", () => {
    const result = paymentOperationSchema.parse({
      ...command,
      receipts: [{ ...command.receipts[0], thirdPartyName: "  Marina Ribeiro  " }],
    });
    assert.equal(result.receipts[0]?.thirdPartyName, "Marina Ribeiro");
  });

  void it("rejects a third-party name for another payment method", () => {
    const result = paymentOperationSchema.safeParse({
      ...command,
      method: "CASH",
      receipts: [{ ...command.receipts[0], thirdPartyName: "Marina Ribeiro" }],
    });
    assert.equal(result.success, false);
  });
});
