import { finance } from "../../packages/api/src/finance/index.js";
import type { DatabaseClient, TransactionClient } from "../../packages/db/src/client.js";
import { DEV_ADMIN, DEV_STUDENTS } from "../../packages/db/src/seed-dev-data.js";
import { createPayment, monthlyDueDate } from "../../packages/db/src/seed-dev-finance.js";
import { isoOf, stableUuid } from "../../packages/db/src/seed-dev-support.js";

const SHARED_PAYER_KEY = "shared-payer";
const DAY_ISO_OFFSET = -2;
const CURRENT_MONTH_OFFSET = -3;
const PAID_MONTH_OFFSET = -8;
const CURRENT_DURATION_MONTHS = 12;
const PAID_DURATION_MONTHS = 6;
const DUE_DAY = 10;
const PARTIAL_DIVISOR = 2;

type Scenario = {
  key: string;
  student: string;
  payer?: "shared-payer" | "bruno-payer";
  outcome: "current" | "future" | "paid" | "late" | "partial" | "cancelled";
  cents: number;
  monthOffset?: number;
  dueDay?: number;
  months?: number;
};
const scenarios: readonly Scenario[] = [
  {
    key: "p05-ana",
    student: "ana",
    payer: SHARED_PAYER_KEY,
    outcome: "current",
    cents: 25_000,
    dueDay: 31,
  },
  {
    key: "p05-bruno",
    student: "bruno",
    payer: "bruno-payer",
    outcome: "current",
    cents: 24_000,
    monthOffset: -2,
    months: 6,
  },
  {
    key: "p05-davi",
    student: "davi",
    payer: SHARED_PAYER_KEY,
    outcome: "current",
    cents: 25_000,
    dueDay: 25,
    months: 18,
  },
  {
    key: "p05-isadora",
    student: "isadora",
    payer: SHARED_PAYER_KEY,
    outcome: "future",
    cents: 25_000,
    monthOffset: 1,
    dueDay: 25,
    months: 6,
  },
  {
    key: "seed-carla",
    student: "carla",
    outcome: "partial",
    cents: 23_000,
    monthOffset: 0,
    dueDay: 1,
  },
  { key: "seed-elisa", student: "elisa", outcome: "current", cents: 22_000 },
  { key: "seed-gabriela", student: "gabriela", outcome: "current", cents: 24_000 },
  { key: "seed-henrique", student: "henrique", outcome: "current", cents: 21_000 },
  { key: "seed-joao", student: "joao", outcome: "current", cents: 25_000 },
  { key: "seed-larissa", student: "larissa", outcome: "current", cents: 23_000 },
  { key: "seed-priscila", student: "priscila", outcome: "current", cents: 24_000 },
  { key: "seed-theo", student: "theo", outcome: "current", cents: 22_000 },
  { key: "seed-marcos", student: "marcos", outcome: "paid", cents: 20_000 },
  { key: "seed-felipe", student: "felipe", outcome: "late", cents: 24_000 },
  { key: "seed-otavio", student: "otavio", outcome: "cancelled", cents: 23_000 },
];

export async function seedContracts(database: DatabaseClient, todayIso: string): Promise<void> {
  const admin = await database.user.findFirstOrThrow({
    where: { email: DEV_ADMIN.email, role: "ADMIN", isEnabled: true, deletedAt: null },
    select: { id: true },
  });
  for (const scenario of scenarios) {
    await database.$transaction(async (transaction) => {
      await seedContract(transaction, { scenario, todayIso, adminId: admin.id });
    });
  }
}

type ScenarioInput = { scenario: Scenario; todayIso: string; adminId: string };
async function seedContract(transaction: TransactionClient, input: ScenarioInput): Promise<void> {
  const { scenario, todayIso, adminId } = input;
  const student = DEV_STUDENTS.find(({ key }) => key === scenario.student);
  if (!student) throw new Error(`Unknown development student ${scenario.student}.`);
  const payerId = scenario.payer
    ? stableUuid(["dev-finance", scenario.payer])
    : stableUuid(["dev-contract-payer", scenario.student]);
  await transaction.payer.upsert({
    where: { id: payerId },
    create: { id: payerId, name: student.guardian?.fullName ?? student.fullName },
    update: {},
  });
  const { firstDueDate, durationMonths } = scenarioTerms(scenario, todayIso);
  const commandId = stableUuid(["dev-contract", scenario.key]);
  const contract =
    (await transaction.contract.findUnique({ where: { commandId }, select: { id: true } })) ??
    (await finance(transaction, adminId).createMonthlyContract({
      commandId,
      studentId: stableUuid(["student", scenario.student]),
      payerId,
      agreedOn: firstDueDate,
      startsOn: firstDueDate,
      durationMonths,
      firstDueDate,
      monthlyAmountCents: scenario.cents,
    }));
  await applyScenarioOutcome(transaction, { ...input, contractId: contract.id, payerId });
  process.stdout.write(`Contract ${scenario.key} ready (${scenario.outcome}).\n`);
}

function scenarioTerms(
  scenario: Scenario,
  todayIso: string,
): { firstDueDate: string; durationMonths: number } {
  const paid = scenario.outcome === "paid";
  return {
    firstDueDate: isoOf(
      monthlyDueDate(todayIso, {
        monthOffset: scenario.monthOffset ?? (paid ? PAID_MONTH_OFFSET : CURRENT_MONTH_OFFSET),
        dueDay: scenario.dueDay ?? DUE_DAY,
      }),
    ),
    durationMonths: scenario.months ?? (paid ? PAID_DURATION_MONTHS : CURRENT_DURATION_MONTHS),
  };
}

async function applyScenarioOutcome(
  transaction: TransactionClient,
  input: ScenarioInput & { contractId: string; payerId: string },
): Promise<void> {
  const { scenario, todayIso, contractId, payerId } = input;
  const order = await transaction.order.findFirstOrThrow({
    where: { contractId, deletedAt: null },
    select: {
      id: true,
      installments: {
        where: { deletedAt: null },
        select: { id: true, sequenceNumber: true, dueDate: true, amountCents: true },
        orderBy: { sequenceNumber: "asc" },
      },
    },
  });
  if (scenario.outcome === "cancelled") {
    await transaction.order.update({
      where: { id: order.id },
      data: {
        cancelledAt: monthlyDueDate(todayIso, {
          monthOffset: 0,
          dueDay: Number(todayIso.slice(DAY_ISO_OFFSET)),
        }),
        cancelledReason: "Cenário de desenvolvimento",
      },
    });
    return;
  }
  if (["late", "future"].includes(scenario.outcome)) return;
  for (const installment of order.installments) {
    if (isoOf(installment.dueDate) > todayIso) continue;
    await createPayment(transaction, {
      scenarioKey: `contract-${scenario.student}-${installment.sequenceNumber}`,
      payerId,
      installmentId: installment.id,
      amountCents:
        scenario.outcome === "partial"
          ? Math.floor(installment.amountCents / PARTIAL_DIVISOR)
          : installment.amountCents,
      date: installment.dueDate,
    });
  }
}
