import {
  buildReceivablesSnapshot,
  deriveInstallmentLedger,
  saoPauloDateOnly,
} from "@lazuli/domain";
import { db, PaymentMethod } from "@lazuli/db";

import { caller, createPayer, createStudent, DEFAULT_ORDER_INPUT } from "./finance-test-support.js";

export const RECEIVABLES_TEST_PREFIX = "GRE-63 ";

const DATE_ONLY_LENGTH = 10;
const YEAR_START_INDEX = 0;
const YEAR_END_INDEX = 4;
const MONTH_START_INDEX = 5;
const MONTH_END_INDEX = 7;
const DAY_START_INDEX = 8;
const MONTH_INDEX_OFFSET = 1;
const THREE_INSTALLMENTS = 3;
const SINGLE_INSTALLMENT = 1;
const PARTIAL_PAYMENT_CENTS = 10_000;
const RECEIVED_THIS_MONTH_CENTS = 15_000;
const OVERDUE_DAY_OFFSET = -40;
const IN_MONTH_FUTURE_DAY_OFFSET = 10;
const FIRST_DAY_OF_MONTH = 1;

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

type FixtureDates = {
  overdueDueDate: string;
  inMonthOverdueDueDate: string;
  futureDueDate: string;
  inMonthIsOverdue: boolean;
};

type ActiveOrderFixture = {
  orderId: string;
  payerId: string;
  studentId: string;
  overdueInstallmentId: string;
  inMonthInstallmentId: string;
  futureInstallmentId: string;
  overdueAmountCents: number;
  inMonthAmountCents: number;
};

export function offsetDateOnly(baseDate: string, dayOffset: number): string {
  const year = Number(baseDate.slice(YEAR_START_INDEX, YEAR_END_INDEX));
  const monthIndex =
    Number(baseDate.slice(MONTH_START_INDEX, MONTH_END_INDEX)) - MONTH_INDEX_OFFSET;
  const day = Number(baseDate.slice(DAY_START_INDEX, DATE_ONLY_LENGTH));
  const shifted = new Date(Date.UTC(year, monthIndex, day + dayOffset));

  return shifted.toISOString().slice(0, DATE_ONLY_LENGTH);
}

export function firstDayOfNextSaoPauloMonth(today: string): string {
  const year = Number(today.slice(YEAR_START_INDEX, YEAR_END_INDEX));
  const monthIndex = Number(today.slice(MONTH_START_INDEX, MONTH_END_INDEX));

  return new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, DATE_ONLY_LENGTH);
}

export function dateOnlyToUtcDate(value: string): Date {
  const year = Number(value.slice(YEAR_START_INDEX, YEAR_END_INDEX));
  const monthIndex = Number(value.slice(MONTH_START_INDEX, MONTH_END_INDEX)) - MONTH_INDEX_OFFSET;
  const day = Number(value.slice(DAY_START_INDEX, DATE_ONLY_LENGTH));

  return new Date(Date.UTC(year, monthIndex, day));
}

export async function createReceivablesFixture(): Promise<ReceivablesFixture> {
  const dates = buildFixtureDates();
  const activeOrder = await createActiveOrderFixture(dates);
  await registerFixturePayments(activeOrder);
  const cancelledOverdueInstallmentId = await createCancelledOverdueInstallment(
    activeOrder.payerId,
    dates.overdueDueDate,
  );
  const waivedOverdueInstallmentId = await createWaivedOverdueInstallment(
    activeOrder.payerId,
    dates.overdueDueDate,
  );

  return {
    ...activeOrder,
    inMonthIsOverdue: dates.inMonthIsOverdue,
    cancelledOverdueInstallmentId,
    waivedOverdueInstallmentId,
  };
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
    const isCollectible = installment.order.cancelledAt === null && installment.waivedAt === null;
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

function buildFixtureDates(): FixtureDates {
  const today = saoPauloDateOnly(new Date());
  const dayOfMonth = Number(today.slice(DAY_START_INDEX, DATE_ONLY_LENGTH));
  const inMonthIsOverdue = dayOfMonth > FIRST_DAY_OF_MONTH;

  return {
    overdueDueDate: offsetDateOnly(today, OVERDUE_DAY_OFFSET),
    inMonthOverdueDueDate: inMonthIsOverdue
      ? offsetDateOnly(today, -FIRST_DAY_OF_MONTH)
      : offsetDateOnly(today, IN_MONTH_FUTURE_DAY_OFFSET),
    futureDueDate: firstDayOfNextSaoPauloMonth(today),
    inMonthIsOverdue,
  };
}

async function createActiveOrderFixture(dates: FixtureDates): Promise<ActiveOrderFixture> {
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
  if (activeOrder.installments.length !== THREE_INSTALLMENTS) {
    throw new Error("Expected three installments on the receivables fixture order.");
  }

  const overdueInstallment = activeOrder.installments[0];
  const inMonthInstallment = activeOrder.installments[1];
  const futureInstallment = activeOrder.installments[2];

  if (
    overdueInstallment === undefined ||
    inMonthInstallment === undefined ||
    futureInstallment === undefined
  ) {
    throw new Error("Expected three installments on the receivables fixture order.");
  }

  const overdueInstallmentId = overdueInstallment.id;
  const inMonthInstallmentId = inMonthInstallment.id;
  const futureInstallmentId = futureInstallment.id;

  await db.installment.update({
    where: { id: overdueInstallmentId },
    data: { dueDate: dateOnlyToUtcDate(dates.overdueDueDate) },
  });
  await db.installment.update({
    where: { id: inMonthInstallmentId },
    data: { dueDate: dateOnlyToUtcDate(dates.inMonthOverdueDueDate) },
  });
  await db.installment.update({
    where: { id: futureInstallmentId },
    data: { dueDate: dateOnlyToUtcDate(dates.futureDueDate) },
  });

  return {
    orderId: activeOrder.order.id,
    payerId: payer.id,
    studentId: student.id,
    overdueInstallmentId,
    inMonthInstallmentId,
    futureInstallmentId,
    overdueAmountCents: overdueInstallment.amountCents,
    inMonthAmountCents: inMonthInstallment.amountCents,
  };
}

async function registerFixturePayments(activeOrder: ActiveOrderFixture): Promise<void> {
  await registerPaymentThisMonth({
    payerId: activeOrder.payerId,
    installmentId: activeOrder.inMonthInstallmentId,
    amountCents: PARTIAL_PAYMENT_CENTS,
  });
  await registerPaymentThisMonth({
    payerId: activeOrder.payerId,
    installmentId: activeOrder.overdueInstallmentId,
    amountCents: RECEIVED_THIS_MONTH_CENTS - PARTIAL_PAYMENT_CENTS,
  });
}

async function createCancelledOverdueInstallment(
  payerId: string,
  overdueDueDate: string,
): Promise<string> {
  const student = await createStudent("Cancelled Student", RECEIVABLES_TEST_PREFIX);
  const cancelledOrder = await caller().finance.createOrder({
    ...DEFAULT_ORDER_INPUT,
    installmentCount: SINGLE_INSTALLMENT,
    payer: { mode: "existing", payerId },
    beneficiaryStudentIds: [student.id],
  });
  const installmentId = cancelledOrder.installments[0]?.id ?? "";

  await db.installment.update({
    where: { id: installmentId },
    data: { dueDate: dateOnlyToUtcDate(overdueDueDate) },
  });
  await db.order.update({
    where: { id: cancelledOrder.order.id },
    data: { cancelledAt: new Date(), cancelledReason: "Test cancel" },
  });

  return installmentId;
}

async function createWaivedOverdueInstallment(
  payerId: string,
  overdueDueDate: string,
): Promise<string> {
  const student = await createStudent("Waived Student", RECEIVABLES_TEST_PREFIX);
  const waivedOrder = await caller().finance.createOrder({
    ...DEFAULT_ORDER_INPUT,
    installmentCount: SINGLE_INSTALLMENT,
    payer: { mode: "existing", payerId },
    beneficiaryStudentIds: [student.id],
  });
  const installmentId = waivedOrder.installments[0]?.id ?? "";

  await db.installment.update({
    where: { id: installmentId },
    data: { dueDate: dateOnlyToUtcDate(overdueDueDate) },
  });
  await caller().finance.waiveInstallment({
    installmentId,
    reason: "Bolsa",
  });

  return installmentId;
}

async function registerPaymentThisMonth(input: {
  payerId: string;
  installmentId: string;
  amountCents: number;
}): Promise<void> {
  await caller().finance.registerPayment({
    payerId: input.payerId,
    date: dateOnlyToUtcDate(saoPauloDateOnly(new Date())),
    amountCents: input.amountCents,
    method: PaymentMethod.PIX,
    allocations: [{ installmentId: input.installmentId, amountCents: input.amountCents }],
  });
}
