import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { config as loadEnvironment } from "dotenv";

import { databaseIt } from "../support/support.js";
import {
  cleanFinanceSchemaTestData,
  createFinanceFixture,
  DUE_DATE,
  EVENT_DATE,
  PAYMENT_AMOUNT_CENTS,
  PRINCIPAL_AMOUNT_CENTS,
  START_DATE,
  TEST_PREFIX,
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

  databaseIt(
    "creates a payer, explicit-kind order, beneficiary, installment, payment entry, and allocation",
    () => createAndReadFinanceGraph(database),
  );

  databaseIt(
    "creates and reads singleton finance settings with the default interest settings",
    () => createAndReadFinanceSettings(database),
  );

  databaseIt("rejects invalid due day and non-positive principal", () =>
    rejectInvalidOrderFacts(database),
  );

  databaseIt("rejects negative payment, allocation, and installment cents", () =>
    rejectNegativeMoneyFacts(database),
  );

  databaseIt("rejects invalid adjustment signs by type", () =>
    rejectInvalidAdjustmentSigns(database),
  );

  databaseIt("rejects waiver and cancellation rows missing required reason facts", () =>
    rejectLifecycleFactsWithoutReasons(database),
  );

  databaseIt("rejects duplicate beneficiary and duplicate allocation pairs", () =>
    rejectDuplicatePairs(database),
  );

  databaseIt("accepts signedOrderArtifactId as a UUID without requiring an artifact row", () =>
    acceptSignedOrderArtifactUuid(database),
  );
});

async function createAndReadFinanceGraph(database: DatabaseClient): Promise<void> {
  const fixture = await createFinanceFixture(database, "Graph");

  const order = await database.order.findUniqueOrThrow({
    include: {
      beneficiaries: { include: { student: true } },
      installments: {
        include: {
          allocations: { include: { paymentEntry: true } },
        },
      },
      payer: true,
    },
    where: { id: fixture.orderId },
  });

  assert.equal(order.kind, OrderKind.TUITION);
  assert.equal(order.principalAmountCents, PRINCIPAL_AMOUNT_CENTS);
  assert.equal(order.payer.name, `${TEST_PREFIX}Payer Graph`);
  assert.equal(order.beneficiaries[0]?.student.fullName, `${TEST_PREFIX}Student Graph`);
  assert.equal(order.installments[0]?.allocations[0]?.amountCents, PAYMENT_AMOUNT_CENTS);
  assert.equal(order.installments[0]?.allocations[0]?.paymentEntry.method, PaymentMethod.PIX);
}

async function createAndReadFinanceSettings(database: DatabaseClient): Promise<void> {
  await database.financeSettings.deleteMany({ where: { id: "singleton" } });

  const settings = await database.financeSettings.create({ data: {} });
  const foundSettings = await database.financeSettings.findUniqueOrThrow({
    where: { id: "singleton" },
  });

  assert.equal(settings.id, "singleton");
  assert.equal(foundSettings.interestRatePctMonthly.toString(), "1");
  await expectConstraintRejection(
    database.financeSettings.create({ data: { id: "not-singleton" } }),
    "FinanceSettings_singleton_id_check",
  );
}

async function rejectInvalidOrderFacts(database: DatabaseClient): Promise<void> {
  const fixture = await createFinanceFixture(database, "Invalid Order Facts");

  await expectConstraintRejection(
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
  await expectConstraintRejection(
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
}

async function rejectNegativeMoneyFacts(database: DatabaseClient): Promise<void> {
  const fixture = await createFinanceFixture(database, "Negative Money");

  await expectConstraintRejection(
    database.installment.create({
      data: {
        amountCents: -1,
        dueDate: DUE_DATE,
        orderId: fixture.orderId,
      },
    }),
    "Installment_amount_cents_non_negative_check",
  );
  await expectConstraintRejection(
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
  await expectConstraintRejection(
    database.paymentAllocation.create({
      data: {
        amountCents: -1,
        installmentId: fixture.installmentId,
        paymentEntryId: fixture.paymentEntryId,
      },
    }),
    "PaymentAllocation_amount_cents_non_negative_check",
  );
}

async function rejectInvalidAdjustmentSigns(database: DatabaseClient): Promise<void> {
  const fixture = await createFinanceFixture(database, "Adjustment Signs");

  await expectAdjustmentSignRejection(database, {
    amountCents: -1,
    installmentId: fixture.installmentId,
    type: InstallmentAdjustmentType.INTEREST,
  });
  await expectAdjustmentSignRejection(database, {
    amountCents: 0,
    installmentId: fixture.installmentId,
    type: InstallmentAdjustmentType.LATE_FEE,
  });
  await expectAdjustmentSignRejection(database, {
    amountCents: 1,
    installmentId: fixture.installmentId,
    type: InstallmentAdjustmentType.DISCOUNT,
  });
  await expectAdjustmentSignRejection(database, {
    amountCents: 0,
    installmentId: fixture.installmentId,
    type: InstallmentAdjustmentType.CORRECTION,
  });
}

async function rejectLifecycleFactsWithoutReasons(database: DatabaseClient): Promise<void> {
  const fixture = await createFinanceFixture(database, "Lifecycle Facts");

  await expectConstraintRejection(
    database.order.update({
      data: { cancelledAt: EVENT_DATE },
      where: { id: fixture.orderId },
    }),
    "Order_cancellation_reason_check",
  );
  await expectConstraintRejection(
    database.order.update({
      data: { cancelledReason: "Cliente desistiu" },
      where: { id: fixture.orderId },
    }),
    "Order_cancellation_reason_check",
  );
  await expectConstraintRejection(
    database.installment.update({
      data: { waivedAt: EVENT_DATE },
      where: { id: fixture.installmentId },
    }),
    "Installment_waiver_reason_check",
  );
  await expectConstraintRejection(
    database.installment.update({
      data: { waivedReason: "Bolsa aprovada" },
      where: { id: fixture.installmentId },
    }),
    "Installment_waiver_reason_check",
  );
}

async function rejectDuplicatePairs(database: DatabaseClient): Promise<void> {
  const fixture = await createFinanceFixture(database, "Duplicate Pairs");

  await expectConstraintRejection(
    database.orderBeneficiary.create({
      data: {
        orderId: fixture.orderId,
        studentId: fixture.studentId,
      },
    }),
    "OrderBeneficiary_order_id_student_id_key",
  );
  await expectConstraintRejection(
    database.paymentAllocation.create({
      data: {
        amountCents: 1,
        installmentId: fixture.installmentId,
        paymentEntryId: fixture.paymentEntryId,
      },
    }),
    "PaymentAllocation_payment_entry_id_installment_id_key",
  );
}

async function acceptSignedOrderArtifactUuid(database: DatabaseClient): Promise<void> {
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

  assert.equal(order.signedOrderArtifactId, SIGNED_ORDER_ARTIFACT_ID);
}

async function expectAdjustmentSignRejection(
  database: DatabaseClient,
  data: {
    amountCents: number;
    installmentId: string;
    type: (typeof InstallmentAdjustmentType)[keyof typeof InstallmentAdjustmentType];
  },
): Promise<void> {
  await expectConstraintRejection(
    database.installmentAdjustment.create({
      data,
    }),
    "InstallmentAdjustment_amount_sign_check",
  );
}

async function expectConstraintRejection(
  action: Promise<unknown>,
  constraintName: string,
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(formatError(error).includes(constraintName), true);
    return true;
  });
}

function formatError(error: Error): string {
  const prismaError = error as Error & { meta?: unknown };
  return `${error.message}\n${JSON.stringify(prismaError.meta)}`;
}
