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
const MIN_UNPAID_INSTALLMENTS = 2;
const MAX_UNPAID_INSTALLMENTS = 5;
const UNPAID_INSTALLMENT_DEPTHS = Array.from(
  { length: MAX_UNPAID_INSTALLMENTS - MIN_UNPAID_INSTALLMENTS + 1 },
  (_unused, index) => MIN_UNPAID_INSTALLMENTS + index,
);
const CONTRACT_MONTHS = 12;
// Older cohorts retain the evidence needed for partial payments and aging buckets.
const OLDEST_CLOSING_MONTHS_AGO = 8;
const HISTORICAL_COHORT_COUNT = 4;
const HISTORICAL_CLOSING_MONTHS_AGO = Array.from(
  { length: HISTORICAL_COHORT_COUNT },
  (_unused, index) => OLDEST_CLOSING_MONTHS_AGO - index,
);
const PUNCTUAL_CLOSING_COHORTS = [
  { monthsAgo: 8, contracts: 35 },
  { monthsAgo: 7, contracts: 24 },
  { monthsAgo: 6, contracts: 20 },
  { monthsAgo: 5, contracts: 16 },
  { monthsAgo: 4, contracts: 26 },
  { monthsAgo: 3, contracts: 22 },
  { monthsAgo: 2, contracts: 18 },
  { monthsAgo: 1, contracts: 16 },
  { monthsAgo: 0, contracts: 10 },
] as const;
const AGREEMENT_DAY_VARIATIONS = 28;
const AGREEMENT_LEAD_DAYS = 7;
const CONTRACT_TRANSACTION_TIMEOUT_MS = 30_000;
const PAYMENT_DAY_OFFSETS = { short: 3, standard: 5, week: 7, extended: 10 };
const LATE_PAYMENT_DAYS = Object.values(PAYMENT_DAY_OFFSETS);
const PAYMENT_ADVANCE_DAYS = [
  1,
  2,
  PAYMENT_DAY_OFFSETS.short,
  PAYMENT_DAY_OFFSETS.standard,
  PAYMENT_DAY_OFFSETS.week,
] as const;
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
  const closingMonths = closingMonthOffsets(contractedStudents);
  for (const [index, student] of contractedStudents.entries()) {
    await database.$transaction(
      async (transaction) => {
        await seedContract(transaction, {
          student,
          index,
          agreementMonthOffset: closingMonths[index]!,
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
  agreementMonthOffset: number;
  todayIso: string;
  adminId: string;
  discountPct: number;
};

async function seedContract(transaction: TransactionClient, input: ContractInput): Promise<void> {
  const { student, index, adminId } = input;
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
  const { agreedOn, firstDueDate } = contractDates(input);
  const contract = await finance(transaction, adminId).createMonthlyContract({
    commandId: stableUuid(["dev-contract", student.key]),
    studentId: stableUuid(["student", student.key]),
    payerId,
    agreedOn,
    startsOn: firstDueDate,
    durationMonths: CONTRACT_MONTHS,
    firstDueDate,
    monthlyAmountCents: MONTHLY_PRICES[selectionIndex % MONTHLY_PRICES.length]!,
  });
  await seedPayments(transaction, { ...input, contractId: contract.id, payerId });
}

function closingMonthOffsets(students: readonly DevStudentSeed[]): number[] {
  let punctualPosition = 0;
  let historicalPosition = 0;
  return students.map((student) => {
    if ((student.financeProfile ?? "punctual") === "punctual")
      return -punctualClosingMonthsAgo(punctualPosition++);
    const monthsAgo =
      HISTORICAL_CLOSING_MONTHS_AGO[historicalPosition++ % HISTORICAL_CLOSING_MONTHS_AGO.length]!;
    return -monthsAgo;
  });
}

function punctualClosingMonthsAgo(position: number): number {
  let remaining = position;
  for (const cohort of PUNCTUAL_CLOSING_COHORTS) {
    if (remaining < cohort.contracts) return cohort.monthsAgo;
    remaining -= cohort.contracts;
  }
  throw new Error("Development contract closing cohorts must cover all punctual students.");
}

function contractDates(input: ContractInput): { agreedOn: string; firstDueDate: string } {
  const { todayIso, index, agreementMonthOffset } = input;
  const selectionIndex = cohortSelectionIndex(index);
  const dayLimit =
    agreementMonthOffset === 0
      ? Math.min(AGREEMENT_DAY_VARIATIONS, utcDate(todayIso).getUTCDate())
      : AGREEMENT_DAY_VARIATIONS;
  const agreedOn = monthlyDueDate(todayIso, {
    monthOffset: agreementMonthOffset,
    dueDay: 1 + (selectionIndex % dayLimit),
  });
  const earliestDue = addDays(agreedOn, AGREEMENT_LEAD_DAYS);
  const dueDay = DUE_DAYS[selectionIndex % DUE_DAYS.length]!;
  let dueMonthOffset = agreementMonthOffset;
  let firstDueDate = monthlyDueDate(todayIso, { monthOffset: dueMonthOffset, dueDay });
  while (firstDueDate < earliestDue) {
    dueMonthOffset += 1;
    firstDueDate = monthlyDueDate(todayIso, { monthOffset: dueMonthOffset, dueDay });
  }
  return { agreedOn: isoOf(agreedOn), firstDueDate: isoOf(firstDueDate) };
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
  const lastOverdue = installments.findLast((row) => isoOf(row.dueDate) < todayIso);
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
    if (delayedIso < input.todayIso) return delayedIso;
    return input.todayIso;
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
