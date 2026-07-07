import { FINANCE_DUE_DAY_FIFTEENTH } from "@lazuli/domain";
import { db, PaymentMethod } from "@lazuli/db";

import {
  caller,
  createPayer,
  createStudent,
  DEFAULT_ORDER_INPUT,
} from "./finance-test-support.js";

export const WAIVER_TEST_PREFIX = "GRE-47 ";
export const PAYMENT_DATE = new Date("2026-04-10T00:00:00.000Z");
export const LOCKED_UPDATE_START_DATE = new Date("2026-02-01T00:00:00.000Z");
export const MISSING_ENTITY_ID = "00000000-0000-0000-0000-000000000099";
export const WAIVER_REASON = "Bolsa integral";
export const DISCOUNT_REASON = "Desconto irmao";
export const DISCOUNT_AMOUNT_CENTS = -5000;
export const INTEREST_AMOUNT_CENTS = 1500;
export const CORRECTION_AMOUNT_CENTS = -2000;
export const PARTIAL_PAYMENT_CENTS = 10_000;
export const FULL_INSTALLMENT_PAYMENT_CENTS = 33_334;
export const LOCKED_UPDATE_PRINCIPAL_CENTS = 80_000;
export const TWO_INSTALLMENTS = 2;

export type OrderFixture = {
  orderId: string;
  payerId: string;
  studentId: string;
  installmentId: string;
};

export async function createOrderFixture(): Promise<OrderFixture> {
  const payer = await createPayer("Waiver Payer", WAIVER_TEST_PREFIX);
  const student = await createStudent("Waiver Student", WAIVER_TEST_PREFIX);
  const result = await caller().finance.createOrder({
    ...DEFAULT_ORDER_INPUT,
    payer: { mode: "existing", payerId: payer.id },
    beneficiaryStudentIds: [student.id],
  });

  return {
    orderId: result.order.id,
    payerId: payer.id,
    studentId: student.id,
    installmentId: result.installments[0]?.id ?? "",
  };
}

export async function allocatePaymentToInstallment(input: {
  payerId: string;
  installmentId: string;
  amountCents: number;
}): Promise<void> {
  const paymentEntry = await db.paymentEntry.create({
    data: {
      payerId: input.payerId,
      date: PAYMENT_DATE,
      amountCents: input.amountCents,
      method: PaymentMethod.PIX,
    },
  });
  await db.paymentAllocation.create({
    data: {
      paymentEntryId: paymentEntry.id,
      installmentId: input.installmentId,
      amountCents: input.amountCents,
    },
  });
}

export async function cancelOrder(orderId: string): Promise<void> {
  await db.order.update({
    where: { id: orderId },
    data: { cancelledAt: new Date(), cancelledReason: "Cliente desistiu" },
  });
}

export async function updateOrderFixture(fixture: OrderFixture): Promise<unknown> {
  return caller().finance.updateOrder({
    orderId: fixture.orderId,
    kind: "TUITION",
    beneficiaryStudentIds: [fixture.studentId],
    principalAmountCents: LOCKED_UPDATE_PRINCIPAL_CENTS,
    installmentCount: TWO_INSTALLMENTS,
    startDate: LOCKED_UPDATE_START_DATE,
    dueDay: FINANCE_DUE_DAY_FIFTEENTH,
  });
}
