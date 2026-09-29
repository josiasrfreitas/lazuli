import { finance } from "../packages/api/src/finance/index.js";
import {
  createDbClient,
  type DatabaseClient,
  type TransactionClient,
} from "../packages/db/src/client.js";
import { getDatabaseUrl } from "../packages/db/src/config.js";
import { DEV_ADMIN, DEV_STUDENTS } from "../packages/db/src/seed-dev-data.js";
import { createPayment, monthlyDueDate } from "../packages/db/src/seed-dev-finance.js";
import { saoPauloTodayIso, stableUuid } from "../packages/db/src/seed-dev-support.js";

const databaseUrl = new URL(getDatabaseUrl());
if (!["localhost", "127.0.0.1", "[::1]"].includes(databaseUrl.hostname)) {
  throw new Error("The contract seed requires a local development database.");
}

const database = createDbClient();
const SHARED_PAYER_KEY = "shared-payer";
const PAID_FIRST_DUE_MONTH_OFFSET = -8;
const CURRENT_FIRST_DUE_MONTH_OFFSET = -3;
const DUE_DAY = 10;
const PAID_DURATION_MONTHS = 6;
const CURRENT_DURATION_MONTHS = 12;
const DATE_ONLY_LENGTH = 10;
const todayIso = saoPauloTodayIso();
const additionalScenarios = [
  { student: "carla", outcome: "current", cents: 23_000 },
  { student: "elisa", outcome: "current", cents: 22_000 },
  { student: "gabriela", outcome: "current", cents: 24_000 },
  { student: "henrique", outcome: "current", cents: 21_000 },
  { student: "joao", outcome: "current", cents: 25_000 },
  { student: "larissa", outcome: "current", cents: 23_000 },
  { student: "priscila", outcome: "current", cents: 24_000 },
  { student: "theo", outcome: "current", cents: 22_000 },
  { student: "marcos", outcome: "paid", cents: 20_000 },
  { student: "felipe", outcome: "late", cents: 24_000 },
  { student: "otavio", outcome: "cancelled", cents: 23_000 },
] as const;
type AdditionalScenario = (typeof additionalScenarios)[number];
try {
  const admin = await database.user.findFirst({
    where: { email: DEV_ADMIN.email, role: "ADMIN", isEnabled: true, deletedAt: null },
    select: { id: true },
  });
  if (!admin) throw new Error("Run pnpm prisma:seed before pnpm seed:contracts.");

  const scenarios = [
    {
      student: "ana",
      payer: SHARED_PAYER_KEY,
      start: "2026-01-31",
      due: "2026-01-31",
      months: 12,
      cents: 25_000,
    },
    {
      student: "bruno",
      payer: "bruno-payer",
      start: "2026-02-15",
      due: "2026-03-10",
      months: 6,
      cents: 24_000,
    },
    {
      student: "davi",
      payer: SHARED_PAYER_KEY,
      start: "2026-03-01",
      due: "2026-03-25",
      months: 18,
      cents: 25_000,
    },
    {
      student: "isadora",
      payer: SHARED_PAYER_KEY,
      start: "2026-10-01",
      due: "2026-10-25",
      months: 6,
      cents: 25_000,
    },
  ] as const;

  for (const scenario of scenarios) {
    const key = `p05-${scenario.student}`;
    const commandId = stableUuid(["dev-contract", key]);
    const existing = await database.contract.findUnique({
      where: { commandId },
      select: { id: true },
    });
    if (existing) {
      process.stdout.write(`Contract ${key} already present.\n`);
      continue;
    }
    const values = {
      commandId,
      studentId: stableUuid(["student", scenario.student]),
      payerId: stableUuid(["dev-finance", scenario.payer]),
      agreedOn: scenario.start,
      startsOn: scenario.start,
      durationMonths: scenario.months,
      firstDueDate: scenario.due,
      monthlyAmountCents: scenario.cents,
    };
    await database.$transaction(async (transaction) => {
      await finance(transaction, admin.id).createMonthlyContract(values);
    });
    process.stdout.write(`Contract ${key} ready.\n`);
  }

  for (const scenario of additionalScenarios) {
    await seedAdditionalContract({ client: database, adminId: admin.id, scenario });
  }
} finally {
  await database.$disconnect();
}

async function seedAdditionalContract({
  client,
  adminId,
  scenario,
}: {
  client: DatabaseClient;
  adminId: string;
  scenario: AdditionalScenario;
}): Promise<void> {
  const student = DEV_STUDENTS.find(({ key }) => key === scenario.student);
  if (!student) throw new Error(`Unknown development student ${scenario.student}.`);
  const key = `seed-${scenario.student}`;
  const commandId = stableUuid(["dev-contract", key]);
  const payerId = stableUuid(["dev-contract-payer", scenario.student]);
  const firstDueDate = monthlyDueDate(todayIso, {
    monthOffset:
      scenario.outcome === "paid" ? PAID_FIRST_DUE_MONTH_OFFSET : CURRENT_FIRST_DUE_MONTH_OFFSET,
    dueDay: DUE_DAY,
  })
    .toISOString()
    .slice(0, DATE_ONLY_LENGTH);

  await client.$transaction(async (transaction) => {
    await transaction.payer.upsert({
      where: { id: payerId },
      create: { id: payerId, name: student.guardian?.fullName ?? student.fullName },
      update: {},
    });
    let contract = await transaction.contract.findUnique({
      where: { commandId },
      select: { id: true },
    });
    if (!contract) {
      contract = await finance(transaction, adminId).createMonthlyContract({
        commandId,
        studentId: stableUuid(["student", scenario.student]),
        payerId,
        agreedOn: firstDueDate,
        startsOn: firstDueDate,
        durationMonths:
          scenario.outcome === "paid" ? PAID_DURATION_MONTHS : CURRENT_DURATION_MONTHS,
        firstDueDate,
        monthlyAmountCents: scenario.cents,
      });
    }
    await applyScenarioOutcome({ transaction, scenario, contractId: contract.id, payerId });
  });
  process.stdout.write(`Contract ${key} ready (${scenario.outcome}).\n`);
}

async function applyScenarioOutcome({
  transaction,
  scenario,
  contractId,
  payerId,
}: {
  transaction: TransactionClient;
  scenario: AdditionalScenario;
  contractId: string;
  payerId: string;
}): Promise<void> {
  const order = await transaction.order.findFirstOrThrow({
    where: { contractId, deletedAt: null },
    select: {
      id: true,
      installments: {
        where: { deletedAt: null },
        select: { id: true, sequenceNumber: true, dueDate: true, amountCents: true },
      },
    },
  });
  if (scenario.outcome === "cancelled") {
    await transaction.order.updateMany({
      where: { id: order.id, cancelledAt: null },
      data: { cancelledAt: new Date(), cancelledReason: "Cenário de desenvolvimento" },
    });
  } else if (scenario.outcome === "current" || scenario.outcome === "paid") {
    for (const installment of order.installments) {
      if (
        scenario.outcome === "current" &&
        installment.dueDate.toISOString().slice(0, DATE_ONLY_LENGTH) > todayIso
      )
        continue;
      await createPayment(transaction, {
        scenarioKey: `contract-${scenario.student}-${installment.sequenceNumber}`,
        payerId,
        installmentId: installment.id,
        amountCents: installment.amountCents,
        date: installment.dueDate,
      });
    }
  }
}
