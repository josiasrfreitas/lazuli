import { finance } from "../../packages/api/src/finance/index.js";
import { priceAfterDiscountCents } from "../../packages/domain/src/monthly-contract.js";
import type { DatabaseClient, TransactionClient } from "../../packages/db/src/client.js";
import {
  DEV_ADMIN,
  DEV_STUDENTS,
  type DevStudentSeed,
} from "../../packages/db/src/seed-dev-data.js";
import { monthlyDueDate } from "../../packages/db/src/seed-dev-finance.js";
import { addDays, isoOf, stableUuid, utcDate } from "../../packages/db/src/seed-dev-support.js";

const STANDARD_MONTHLY_PRICE = 25_000;
const NEGOTIATED_MONTHLY_PRICE_240 = 24_000;
const NEGOTIATED_MONTHLY_PRICE_230 = 23_000;
const NEGOTIATED_MONTHLY_PRICE_220 = 22_000;
const NEGOTIATED_MONTHLY_PRICE_210 = 21_000;
const NEGOTIATED_MONTHLY_PRICE_200 = 20_000;
const MONTHLY_PRICES = [
  STANDARD_MONTHLY_PRICE,
  STANDARD_MONTHLY_PRICE,
  NEGOTIATED_MONTHLY_PRICE_240,
  STANDARD_MONTHLY_PRICE,
  NEGOTIATED_MONTHLY_PRICE_230,
  STANDARD_MONTHLY_PRICE,
  NEGOTIATED_MONTHLY_PRICE_220,
  STANDARD_MONTHLY_PRICE,
  NEGOTIATED_MONTHLY_PRICE_210,
  NEGOTIATED_MONTHLY_PRICE_200,
];
const FIRST_DUE_DAY = 5;
const DUE_DAY_INTERVAL = 5;
const DUE_DAY_OPTIONS = 5;
const DUE_DAYS = Array.from(
  { length: DUE_DAY_OPTIONS },
  (_unused, index) => FIRST_DUE_DAY + index * DUE_DAY_INTERVAL,
);
const CONTRACT_COHORT_SIZE = 20;
const UNPAID_INSTALLMENT_DEPTHS = [2, 3, 4, 5] as const;
const CONTRACT_MONTHS = 12;
const EARLIEST_START_MONTHS_AGO = 6;
const START_MONTH_VARIATIONS = 3;
const AGREEMENT_LEAD_DAYS = 7;
const CONTRACT_TRANSACTION_TIMEOUT_MS = 30_000;
const LATE_PAYMENT_DAYS = [3, 5, 7, 10] as const;
const PAYMENT_ADVANCE_DAYS = [1, 2, 3, 5, 7] as const;
const YEAR_END_MONTH = 11;
const MID_YEAR_MONTH = 6;
const YEAR_END_ADVANCE_DAYS = 7;
const MID_YEAR_ADVANCE_DAYS = 5;
const PAYMENT_METHOD_STRIDE = 3;
const PAYMENT_METHODS = [
  "PIX",
  "PIX",
  "CARD",
  "PIX",
  "TRANSFER",
  "PIX",
  "CARD",
  "PIX",
  "CASH",
  "PIX",
] as const;

/** Allocated students have independent annual contracts; sibling contracts may share a payer. */
export async function seedContracts(database: DatabaseClient, todayIso: string): Promise<void> {
  const admin = await database.user.findUniqueOrThrow({ where: { email: DEV_ADMIN.email } });
  const settings = await database.financeSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  const contractedStudents = DEV_STUDENTS.filter((student) => student.enrollments.length > 0);
  for (const [index, student] of contractedStudents.entries()) {
    await database.$transaction(
      async (transaction) => {
        await seedContract(transaction, {
          student,
          index,
          todayIso,
          adminId: admin.id,
          discountPct: Number(settings.punctualityDiscountPct),
        });
      },
      { timeout: CONTRACT_TRANSACTION_TIMEOUT_MS },
    );
  }
  process.stdout.write(
    `${contractedStudents.length} annual contracts loaded with punctual, partial and overdue payment histories.\n`,
  );
}

type ContractInput = {
  student: DevStudentSeed;
  index: number;
  todayIso: string;
  adminId: string;
  discountPct: number;
};

async function seedContract(transaction: TransactionClient, input: ContractInput): Promise<void> {
  const { student, index, todayIso, adminId } = input;
  const payerId = stableUuid(["dev-contract-payer", payerKey(student)]);
  const selectionIndex = cohortSelectionIndex(index);
  await transaction.payer.upsert({
    where: { id: payerId },
    update: {},
    create: {
      id: payerId,
      name: student.guardian?.fullName ?? student.fullName,
      phone: student.guardian?.phone ?? student.phone ?? null,
      email: student.guardian?.email ?? student.email ?? null,
    },
  });
  // Ongoing annual terms start before the current academic semester, even at year boundaries.
  const firstDueDate = isoOf(
    monthlyDueDate(todayIso, {
      monthOffset: -EARLIEST_START_MONTHS_AGO - (index % START_MONTH_VARIATIONS),
      dueDay: DUE_DAYS[selectionIndex % DUE_DAYS.length]!,
    }),
  );
  const contract = await finance(transaction, adminId).createMonthlyContract({
    commandId: stableUuid(["dev-contract", student.key]),
    studentId: stableUuid(["student", student.key]),
    payerId,
    agreedOn: isoOf(addDays(utcDate(firstDueDate), -AGREEMENT_LEAD_DAYS)),
    startsOn: firstDueDate,
    durationMonths: CONTRACT_MONTHS,
    firstDueDate,
    monthlyAmountCents: MONTHLY_PRICES[selectionIndex % MONTHLY_PRICES.length]!,
  });
  await seedPayments(transaction, { ...input, contractId: contract.id, payerId });
}

function payerKey(student: DevStudentSeed): string {
  return student.guardian?.key ?? student.key;
}

function cohortSelectionIndex(index: number): number {
  return index + Math.floor(index / CONTRACT_COHORT_SIZE);
}

async function seedPayments(
  transaction: TransactionClient,
  input: ContractInput & { contractId: string; payerId: string },
): Promise<void> {
  const { student, index, todayIso, adminId, payerId, contractId } = input;
  const installments = await transaction.installment.findMany({
    where: { order: { contractId } },
    orderBy: { sequenceNumber: "asc" },
  });
  const isLate = student.financeProfile === "overdue";
  const lastOverdue = installments.filter((row) => isoOf(row.dueDate) < todayIso).at(-1);
  const unpaidCount =
    UNPAID_INSTALLMENT_DEPTHS[
      Math.floor(index / CONTRACT_COHORT_SIZE) % UNPAID_INSTALLMENT_DEPTHS.length
    ]!;
  const unpaidIds = new Set(
    isLate
      ? installments
          .filter((row) => isoOf(row.dueDate) < todayIso)
          .slice(-unpaidCount)
          .map((row) => row.id)
      : [],
  );
  for (const installment of installments) {
    if (isoOf(installment.dueDate) > todayIso || unpaidIds.has(installment.id)) continue;
    const payment = await fixturePayment(transaction, {
      ...input,
      installment,
      partial: student.financeProfile === "partial" && installment.id === lastOverdue?.id,
    });
    await finance(transaction, adminId).registerPayment({
      commandId: stableUuid([
        "dev-contract-payment",
        student.key,
        String(installment.sequenceNumber),
      ]),
      payerId,
      ...payment,
      method: fixturePaymentMethod(index, installment.sequenceNumber),
      allocations: [{ installmentId: installment.id, amountCents: payment.amountCents }],
    });
  }
}

type SeedInstallment = { id: string; dueDate: Date; amountCents: number; sequenceNumber: number };

async function fixturePayment(
  transaction: TransactionClient,
  input: ContractInput & {
    installment: SeedInstallment;
    partial: boolean;
  },
): Promise<{ date: Date; amountCents: number }> {
  const { installment, todayIso } = input;
  const dueIso = isoOf(installment.dueDate);
  const paymentIso = fixturePaymentDate(input);
  const amountCents = input.partial
    ? Math.floor(installment.amountCents / 2)
    : priceAfterDiscountCents(installment.amountCents, input.discountPct);
  if (paymentIso <= dueIso) return { date: utcDate(paymentIso), amountCents };
  const [preview] = await finance(transaction, input.adminId).previewPayments(
    {
      date: paymentIso,
      items: [{ installmentId: installment.id }],
    },
    new Date(`${todayIso}T12:00:00.000Z`),
  );
  if (!preview?.line) throw new Error(preview?.error ?? "Missing development payment quote.");
  return { date: utcDate(paymentIso), amountCents: preview.line.quote.settlementCents };
}

function fixturePaymentDate(input: ContractInput & { installment: SeedInstallment }): string {
  const dueIso = isoOf(input.installment.dueDate);
  const delay =
    LATE_PAYMENT_DAYS[Math.floor(input.index / CONTRACT_COHORT_SIZE) % LATE_PAYMENT_DAYS.length]!;
  const delayedIso = isoOf(addDays(input.installment.dueDate, delay));
  if (input.student.financeProfile === "late-settled" && dueIso < input.todayIso) {
    return delayedIso < input.todayIso ? delayedIso : input.todayIso;
  }
  return isoOf(addDays(input.installment.dueDate, -paymentAdvanceDays(input)));
}

function paymentAdvanceDays(input: ContractInput & { installment: SeedInstallment }): number {
  const month = input.installment.dueDate.getUTCMonth();
  if (month === YEAR_END_MONTH) return YEAR_END_ADVANCE_DAYS;
  if (month === MID_YEAR_MONTH) return MID_YEAR_ADVANCE_DAYS;
  const variation = cohortSelectionIndex(input.index) + input.installment.sequenceNumber;
  return PAYMENT_ADVANCE_DAYS[variation % PAYMENT_ADVANCE_DAYS.length]!;
}

function fixturePaymentMethod(
  index: number,
  sequenceNumber: number,
): (typeof PAYMENT_METHODS)[number] {
  const variation = cohortSelectionIndex(index) + sequenceNumber * PAYMENT_METHOD_STRIDE;
  return PAYMENT_METHODS[variation % PAYMENT_METHODS.length]!;
}
