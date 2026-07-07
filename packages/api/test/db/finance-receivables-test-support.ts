import {
  buildReceivablesSnapshot,
  deriveInstallmentLedger,
  saoPauloDateOnly,
} from "@lazuli/domain";
import { db, PaymentMethod } from "@lazuli/db";

import {
  caller,
  createPayer,
  createStudent,
  DEFAULT_ORDER_INPUT,
} from "./finance-test-support.js";

export const RECEIVABLES_TEST_PREFIX = "GRE-63 ";

const THREE_INSTALLMENTS = 3;
const PARTIAL_PAYMENT_CENTS = 10_000;
const RECEIVED_THIS_MONTH_CENTS = 15_000;

export type ReceivablesFixture = {
  overdueInstallmentId: string;
  inMonthInstallmentId: string;
  futureInstallmentId: string;
  overdueAmountCents: number;
  inMonthAmountCents: number;
  inMonthIsOverdue: boolean;
  payerId: string;
  studentId: string;
  cancelledOverdueInstallmentId: string;
  waivedOverdueInstallmentId: string;
};

const DATE_ONLY_LENGTH = 10;

export function offsetDateOnly(baseDate: string, dayOffset: number): string {
  const year = Number(baseDate.slice(0, 4));
  const monthIndex = Number(baseDate.slice(5, 7)) - 1;
  const day = Number(baseDate.slice(8, DATE_ONLY_LENGTH));
  const shifted = new Date(Date.UTC(year, monthIndex, day + dayOffset));

  return shifted.toISOString().slice(0, DATE_ONLY_LENGTH);
}

export function firstDayOfNextSaoPauloMonth(today: string): string {
  const year = Number(today.slice(0, 4));
  const monthIndex = Number(today.slice(5, 7));

  return new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, DATE_ONLY_LENGTH);
}

export function dateOnlyToUtcDate(value: string): Date {
  const year = Number(value.slice(0, 4));
  const monthIndex = Number(value.slice(5, 7)) - 1;
  const day = Number(value.slice(8, DATE_ONLY_LENGTH));

  return new Date(Date.UTC(year, monthIndex, day));
}

export async function createReceivablesFixture(): Promise<ReceivablesFixture> {
  const today = saoPauloDateOnly(new Date());
  const dayOfMonth = Number(today.slice(8, DATE_ONLY_LENGTH));
  const overdueDueDate = offsetDateOnly(today, -40);
  const inMonthOverdueDueDate =
    dayOfMonth > 1 ? offsetDateOnly(today, -1) : offsetDateOnly(today, 10);
  const futureDueDate = firstDayOfNextSaoPauloMonth(today);

  const payer = await createPayer("Receivables Payer", RECEIVABLES_TEST_PREFIX);
  const student = await db.student.create({
    data: {
      fullName: `${RECEIVABLES_TEST_PREFIX}Receivables Student`,
      status: "ACTIVE",
      phone: "82999887766",
    },
    select: { id: true },
  });

  const activeOrder = await caller().finance.createOrder({
    ...DEFAULT_ORDER_INPUT,
    installmentCount: THREE_INSTALLMENTS,
    payer: { mode: "existing", payerId: payer.id },
    beneficiaryStudentIds: [student.id],
  });

  const [overdueInstallmentId, inMonthInstallmentId, futureInstallmentId] =
    activeOrder.installments.map((installment) => installment.id);
  const overdueAmountCents = activeOrder.installments[0]?.amountCents ?? 0;
  const inMonthAmountCents = activeOrder.installments[1]?.amountCents ?? 0;

  await db.installment.update({
    where: { id: overdueInstallmentId },
    data: { dueDate: dateOnlyToUtcDate(overdueDueDate) },
  });
  await db.installment.update({
    where: { id: inMonthInstallmentId },
    data: { dueDate: dateOnlyToUtcDate(inMonthOverdueDueDate) },
  });
  await db.installment.update({
    where: { id: futureInstallmentId },
    data: { dueDate: dateOnlyToUtcDate(futureDueDate) },
  });

  await registerPaymentThisMonth({
    payerId: payer.id,
    installmentId: inMonthInstallmentId,
    amountCents: PARTIAL_PAYMENT_CENTS,
  });
  await registerPaymentThisMonth({
    payerId: payer.id,
    installmentId: overdueInstallmentId,
    amountCents: RECEIVED_THIS_MONTH_CENTS - PARTIAL_PAYMENT_CENTS,
  });

  const cancelledStudent = await createStudent("Cancelled Student", RECEIVABLES_TEST_PREFIX);
  const cancelledOrder = await caller().finance.createOrder({
    ...DEFAULT_ORDER_INPUT,
    installmentCount: 1,
    payer: { mode: "existing", payerId: payer.id },
    beneficiaryStudentIds: [cancelledStudent.id],
  });
  const cancelledOverdueInstallmentId = cancelledOrder.installments[0]?.id ?? "";
  await db.installment.update({
    where: { id: cancelledOverdueInstallmentId },
    data: { dueDate: dateOnlyToUtcDate(overdueDueDate) },
  });
  await db.order.update({
    where: { id: cancelledOrder.order.id },
    data: { cancelledAt: new Date(), cancelledReason: "Test cancel" },
  });

  const waivedStudent = await createStudent("Waived Student", RECEIVABLES_TEST_PREFIX);
  const waivedOrder = await caller().finance.createOrder({
    ...DEFAULT_ORDER_INPUT,
    installmentCount: 1,
    payer: { mode: "existing", payerId: payer.id },
    beneficiaryStudentIds: [waivedStudent.id],
  });
  const waivedOverdueInstallmentId = waivedOrder.installments[0]?.id ?? "";
  await db.installment.update({
    where: { id: waivedOverdueInstallmentId },
    data: { dueDate: dateOnlyToUtcDate(overdueDueDate) },
  });
  await caller().finance.waiveInstallment({
    installmentId: waivedOverdueInstallmentId,
    reason: "Bolsa",
  });

  return {
    overdueInstallmentId: overdueInstallmentId ?? "",
    inMonthInstallmentId: inMonthInstallmentId ?? "",
    futureInstallmentId: futureInstallmentId ?? "",
    overdueAmountCents,
    inMonthAmountCents,
    inMonthIsOverdue: dayOfMonth > 1,
    payerId: payer.id,
    studentId: student.id,
    cancelledOverdueInstallmentId,
    waivedOverdueInstallmentId,
  };
}

async function registerPaymentThisMonth(input: {
  payerId: string;
  installmentId: string;
  amountCents: number;
}): Promise<void> {
  const today = saoPauloDateOnly(new Date());

  await caller().finance.registerPayment({
    payerId: input.payerId,
    date: today,
    amountCents: input.amountCents,
    method: PaymentMethod.PIX,
    allocations: [{ installmentId: input.installmentId, amountCents: input.amountCents }],
  });
}

export async function computeExpectedSnapshotTotals(
  fixture: ReceivablesFixture,
): Promise<ReturnType<typeof buildReceivablesSnapshot>> {
  const now = new Date();
  const installments = await db.installment.findMany({
    where: {
      id: {
        in: [
          fixture.overdueInstallmentId,
          fixture.inMonthInstallmentId,
          fixture.futureInstallmentId,
        ],
      },
    },
    select: {
      dueDate: true,
      amountCents: true,
      waivedAt: true,
      order: { select: { cancelledAt: true } },
      adjustments: { select: { amountCents: true } },
      allocations: { select: { amountCents: true } },
    },
  });

  const snapshotInstallments = installments.map((installment) => {
    const isCollectible =
      installment.order.cancelledAt === null && installment.waivedAt === null;
    const ledger = deriveInstallmentLedger({
      amountCents: installment.amountCents,
      dueDate: installment.dueDate,
      waivedAt: installment.waivedAt,
      orderCancelledAt: installment.order.cancelledAt,
      adjustments: installment.adjustments,
      allocations: installment.allocations,
      now,
      interestRatePctMonthly: 1,
    });

    return {
      dueDate: installment.dueDate,
      isCollectible,
      ledger,
    };
  });

  return buildReceivablesSnapshot({
    now,
    receivedThisMonthCents: RECEIVED_THIS_MONTH_CENTS,
    installments: snapshotInstallments,
  });
}
