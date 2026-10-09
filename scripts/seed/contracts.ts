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
const UNPAID_INSTALLMENTS = 2;
const CONTRACT_MONTHS = 12;
const DELINQUENCY_CYCLE = 20;
const DELINQUENCY_SPREAD = 37;
const EARLIEST_START_MONTHS_AGO = 6;
const START_MONTH_VARIATIONS = 3;
const AGREEMENT_LEAD_DAYS = 7;
const CONTRACT_TRANSACTION_TIMEOUT_MS = 30_000;

/** Every student has one annual contract; 95% have settled every due installment. */
export async function seedContracts(database: DatabaseClient, todayIso: string): Promise<void> {
  const admin = await database.user.findUniqueOrThrow({ where: { email: DEV_ADMIN.email } });
  const settings = await database.financeSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  for (const [index, student] of DEV_STUDENTS.entries()) {
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
    `${DEV_STUDENTS.length} annual contracts loaded; ${Math.floor(DEV_STUDENTS.length / DELINQUENCY_CYCLE)} with overdue installments.\n`,
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
  const payerId = stableUuid(["dev-contract-payer", student.key]);
  await transaction.payer.create({
    data: {
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
      dueDay: DUE_DAYS[index % DUE_DAYS.length]!,
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
    monthlyAmountCents: MONTHLY_PRICES[index % MONTHLY_PRICES.length]!,
  });
  await seedPayments(transaction, { ...input, contractId: contract.id, payerId });
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
  const isLate =
    (index * DELINQUENCY_SPREAD) % DEV_STUDENTS.length <
    Math.floor(DEV_STUDENTS.length / DELINQUENCY_CYCLE);
  const unpaidIds = new Set(
    isLate
      ? installments
          .filter((row) => isoOf(row.dueDate) < todayIso)
          .slice(-UNPAID_INSTALLMENTS)
          .map((row) => row.id)
      : [],
  );
  for (const installment of installments) {
    if (isoOf(installment.dueDate) > todayIso || unpaidIds.has(installment.id)) continue;
    const amountCents = priceAfterDiscountCents(installment.amountCents, input.discountPct);
    await finance(transaction, adminId).registerPayment({
      commandId: stableUuid([
        "dev-contract-payment",
        student.key,
        String(installment.sequenceNumber),
      ]),
      payerId,
      date: addDays(installment.dueDate, -1),
      amountCents,
      method: "PIX",
      allocations: [{ installmentId: installment.id, amountCents }],
    });
  }
}
