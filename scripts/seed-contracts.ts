import { finance } from "../packages/api/src/finance/index.js";
import { createDbClient } from "../packages/db/src/client.js";
import { getDatabaseUrl } from "../packages/db/src/config.js";
import { DEV_ADMIN } from "../packages/db/src/seed-dev-data.js";
import { stableUuid } from "../packages/db/src/seed-dev-support.js";

const databaseUrl = new URL(getDatabaseUrl());
if (!["localhost", "127.0.0.1", "[::1]"].includes(databaseUrl.hostname)) {
  throw new Error("The contract seed requires a local development database.");
}

const database = createDbClient();
const SHARED_PAYER_KEY = "shared-payer";
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
      discount: 20,
    },
    {
      student: "bruno",
      payer: "bruno-payer",
      start: "2026-02-15",
      due: "2026-03-10",
      months: 6,
      cents: 24_000,
      discount: 10,
    },
    {
      student: "davi",
      payer: SHARED_PAYER_KEY,
      start: "2026-03-01",
      due: "2026-03-25",
      months: 18,
      cents: 25_000,
      discount: 5,
    },
    {
      student: "isadora",
      payer: SHARED_PAYER_KEY,
      start: "2026-10-01",
      due: "2026-10-25",
      months: 6,
      cents: 25_000,
      discount: 0,
    },
  ] as const;

  for (const scenario of scenarios) {
    const key = `p05-${scenario.student}`;
    const values = {
      commandId: stableUuid(["dev-contract", key]),
      studentId: stableUuid(["student", scenario.student]),
      payerId: stableUuid(["dev-finance", scenario.payer]),
      agreedOn: scenario.start,
      startsOn: scenario.start,
      durationMonths: scenario.months,
      firstDueDate: scenario.due,
      monthlyAmountCents: scenario.cents,
      punctualityDiscountPct: scenario.discount,
    };
    await database.$transaction(async (transaction) => {
      await finance(transaction, admin.id).createMonthlyContract(values);
    });
    process.stdout.write(`Contract ${key} ready.\n`);
  }
} finally {
  await database.$disconnect();
}
