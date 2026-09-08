import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { config as loadEnvironment } from "dotenv";
import {
  cleanFinanceSchemaTestData,
  createFinanceFixture,
  DUE_DATE,
  EVENT_DATE,
  START_DATE,
} from "../support/finance-schema-support.js";
loadEnvironment({ path: new URL("../../../../.env", import.meta.url), quiet: true });
const { createDbClient } = await import("../../src/client.js");
const { InstallmentAdjustmentType, OrderKind, PaymentMethod } = await import("../../src/index.js");
const SIGNED_ORDER_ARTIFACT_ID = "11111111-1111-4111-8111-111111111111";
type DatabaseClient = ReturnType<typeof createDbClient>;
void describe("finance schema", () => {
  const database = createDbClient();
  void before(async () => {
    await database.$connect();
  });
  void after(async () => {
    await cleanFinanceSchemaTestData(database);
    await database.$disconnect();
  });
  registerSchemaTest1(database);
  registerSchemaTest2(database);
  registerSchemaTest3(database);
  registerSchemaTest4(database);
  registerSchemaTest5(database);
  registerSchemaTest6(database);
  registerSchemaTest7(database);
});
async function acceptSignedOrderArtifactUuid(database: DatabaseClient): Promise<string | null> {
  const fixture = await createFinanceFixture(database, "Artifact UUID");
  const order = await database.order.create({
    data: {
      dueDay: 10,
      kind: OrderKind.OTHER,
      payerId: fixture.payerId,
      principalAmountCents: 5000,
      signedOrderArtifactId: SIGNED_ORDER_ARTIFACT_ID,
      startDate: START_DATE,
    },
  });
  return order.signedOrderArtifactId;
}
async function expectAdjustmentSignRejection(
  database: DatabaseClient,
  data: {
    amountCents: number;
    installmentId: string;
    type: (typeof InstallmentAdjustmentType)[keyof typeof InstallmentAdjustmentType];
  },
): Promise<string> {
  const observedConstraint1 = await expectConstraintRejection(
    database.installmentAdjustment.create({
      data,
    }),
    "InstallmentAdjustment_amount_sign_check",
  );
  assert.equal(observedConstraint1.includes("InstallmentAdjustment_amount_sign_check"), true);
  return observedConstraint1;
}
async function expectConstraintRejection(
  action: Promise<unknown>,
  constraintName: string,
): Promise<string> {
  let observedMessage: string | undefined;
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof Error);
    observedMessage = formatError(error);
    assert.equal(observedMessage.includes(constraintName), true);
    return true;
  });
  assert.notEqual(observedMessage, undefined);
  return observedMessage as string;
}
function formatError(error: Error): string {
  const prismaError = error as Error & {
    meta?: unknown;
  };
  return `${error.message}\n${JSON.stringify(prismaError.meta)}`;
}
function registerSchemaTest1(database: DatabaseClient): void {
  void it("creates and reads singleton finance settings with the default interest settings", async () => {
    await database.financeSettings.deleteMany({ where: { id: "singleton" } });
    const settings = await database.financeSettings.create({ data: {} });
    const foundSettings = await database.financeSettings.findUniqueOrThrow({
      where: { id: "singleton" },
    });
    assert.equal(settings.id, "singleton");
    assert.equal(foundSettings.interestRatePctMonthly.toString(), "1");
    const observedConstraint2 = await expectConstraintRejection(
      database.financeSettings.create({ data: { id: "not-singleton" } }),
      "FinanceSettings_singleton_id_check",
    );
    assert.equal(observedConstraint2.includes("FinanceSettings_singleton_id_check"), true);
  });
}
function registerSchemaTest2(database: DatabaseClient): void {
  void it("rejects invalid due day and non-positive principal", async () => {
    const fixture = await createFinanceFixture(database, "Invalid Order Facts");
    const observedConstraint3 = await expectConstraintRejection(
      database.order.create({
        data: {
          dueDay: 7,
          kind: OrderKind.TUITION,
          payerId: fixture.payerId,
          principalAmountCents: 1000,
          startDate: START_DATE,
        },
      }),
      "Order_due_day_check",
    );
    assert.equal(observedConstraint3.includes("Order_due_day_check"), true);
    const observedConstraint4 = await expectConstraintRejection(
      database.order.create({
        data: {
          dueDay: 5,
          kind: OrderKind.TUITION,
          payerId: fixture.payerId,
          principalAmountCents: 0,
          startDate: START_DATE,
        },
      }),
      "Order_principal_amount_cents_positive_check",
    );
    assert.equal(observedConstraint4.includes("Order_principal_amount_cents_positive_check"), true);
  });
}
function registerSchemaTest3(database: DatabaseClient): void {
  void it("rejects negative payment, allocation, and installment cents", async () => {
    const fixture = await createFinanceFixture(database, "Negative Money");
    const observedConstraint5 = await expectConstraintRejection(
      database.installment.create({
        data: {
          amountCents: -1,
          dueDate: DUE_DATE,
          orderId: fixture.orderId,
        },
      }),
      "Installment_amount_cents_non_negative_check",
    );
    assert.equal(observedConstraint5.includes("Installment_amount_cents_non_negative_check"), true);
    const observedConstraint6 = await expectConstraintRejection(
      database.paymentEntry.create({
        data: {
          amountCents: -1,
          date: EVENT_DATE,
          method: PaymentMethod.CASH,
          payerId: fixture.payerId,
        },
      }),
      "PaymentEntry_amount_cents_non_negative_check",
    );
    assert.equal(
      observedConstraint6.includes("PaymentEntry_amount_cents_non_negative_check"),
      true,
    );
    const observedConstraint7 = await expectConstraintRejection(
      database.paymentAllocation.create({
        data: {
          amountCents: -1,
          installmentId: fixture.installmentId,
          paymentEntryId: fixture.paymentEntryId,
        },
      }),
      "PaymentAllocation_amount_cents_non_negative_check",
    );
    assert.equal(
      observedConstraint7.includes("PaymentAllocation_amount_cents_non_negative_check"),
      true,
    );
  });
}
function registerSchemaTest4(database: DatabaseClient): void {
  void it("rejects invalid adjustment signs by type", async () => {
    const fixture = await createFinanceFixture(database, "Adjustment Signs");
    const observedConstraint8 = await expectAdjustmentSignRejection(database, {
      amountCents: -1,
      installmentId: fixture.installmentId,
      type: InstallmentAdjustmentType.INTEREST,
    });
    assert.equal(observedConstraint8.includes("InstallmentAdjustment_amount_sign_check"), true);
    const observedConstraint9 = await expectAdjustmentSignRejection(database, {
      amountCents: 0,
      installmentId: fixture.installmentId,
      type: InstallmentAdjustmentType.LATE_FEE,
    });
    assert.equal(observedConstraint9.includes("InstallmentAdjustment_amount_sign_check"), true);
    const observedConstraint10 = await expectAdjustmentSignRejection(database, {
      amountCents: 1,
      installmentId: fixture.installmentId,
      type: InstallmentAdjustmentType.DISCOUNT,
    });
    assert.equal(observedConstraint10.includes("InstallmentAdjustment_amount_sign_check"), true);
    const observedConstraint11 = await expectAdjustmentSignRejection(database, {
      amountCents: 0,
      installmentId: fixture.installmentId,
      type: InstallmentAdjustmentType.CORRECTION,
    });
    assert.equal(observedConstraint11.includes("InstallmentAdjustment_amount_sign_check"), true);
  });
}
function registerSchemaTest5(database: DatabaseClient): void {
  void it("rejects waiver and cancellation rows missing required reason facts", async () => {
    const fixture = await createFinanceFixture(database, "Lifecycle Facts");
    const observedConstraint12 = await expectConstraintRejection(
      database.order.update({
        data: { cancelledAt: EVENT_DATE },
        where: { id: fixture.orderId },
      }),
      "Order_cancellation_reason_check",
    );
    assert.equal(observedConstraint12.includes("Order_cancellation_reason_check"), true);
    const observedConstraint13 = await expectConstraintRejection(
      database.order.update({
        data: { cancelledReason: "Cliente desistiu" },
        where: { id: fixture.orderId },
      }),
      "Order_cancellation_reason_check",
    );
    assert.equal(observedConstraint13.includes("Order_cancellation_reason_check"), true);
    const observedConstraint14 = await expectConstraintRejection(
      database.installment.update({
        data: { waivedAt: EVENT_DATE },
        where: { id: fixture.installmentId },
      }),
      "Installment_waiver_reason_check",
    );
    assert.equal(observedConstraint14.includes("Installment_waiver_reason_check"), true);
    const observedConstraint15 = await expectConstraintRejection(
      database.installment.update({
        data: { waivedReason: "Bolsa aprovada" },
        where: { id: fixture.installmentId },
      }),
      "Installment_waiver_reason_check",
    );
    assert.equal(observedConstraint15.includes("Installment_waiver_reason_check"), true);
  });
}
function registerSchemaTest6(database: DatabaseClient): void {
  void it("rejects duplicate beneficiary and duplicate allocation pairs", async () => {
    const fixture = await createFinanceFixture(database, "Duplicate Pairs");
    const observedConstraint16 = await expectConstraintRejection(
      database.orderBeneficiary.create({
        data: {
          orderId: fixture.orderId,
          studentId: fixture.studentId,
        },
      }),
      "OrderBeneficiary_order_id_student_id_key",
    );
    assert.equal(observedConstraint16.includes("OrderBeneficiary_order_id_student_id_key"), true);
    const observedConstraint17 = await expectConstraintRejection(
      database.paymentAllocation.create({
        data: {
          amountCents: 1,
          installmentId: fixture.installmentId,
          paymentEntryId: fixture.paymentEntryId,
        },
      }),
      "PaymentAllocation_payment_entry_id_installment_id_key",
    );
    assert.equal(
      observedConstraint17.includes("PaymentAllocation_payment_entry_id_installment_id_key"),
      true,
    );
  });
}
function registerSchemaTest7(database: DatabaseClient): void {
  void it("accepts signedOrderArtifactId without a matching artifact row", async () => {
    const matchingArtifacts = await database.generatedArtifact.count({
      where: { id: SIGNED_ORDER_ARTIFACT_ID },
    });
    const storedArtifactId = await acceptSignedOrderArtifactUuid(database);
    assert.equal(matchingArtifacts, 0);
    assert.equal(storedArtifactId, SIGNED_ORDER_ARTIFACT_ID);
  });
}
