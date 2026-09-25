import { createDbClient } from "../packages/db/src/client.js";
import { getDatabaseUrl } from "../packages/db/src/config.js";
import { DEV_SYSTEM_ADMIN } from "../packages/db/src/seed-dev-data.js";

const databaseUrl = new URL(getDatabaseUrl());
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
if (!localHosts.has(databaseUrl.hostname)) {
  throw new Error("The settings seed requires a local development database.");
}

const database = createDbClient();
try {
  const author = await database.user.findFirst({
    where: {
      email: DEV_SYSTEM_ADMIN.email,
      role: "SYSTEM_ADMIN",
      isEnabled: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (author === null) {
    throw new Error("Run the development staff seed before seeding finance settings.");
  }
  const defaults = {
    tuitionCeilingCents: 25_000,
    maximumDiscountPct: "20",
    punctualityDiscountPct: "10",
    interestRatePctDaily: "0.1",
    interestRatePctMonthly: "2",
    cancellationFeePct: "10",
    materialPriceCents: 12_000,
  };
  const existing = await database.financeSettings.findUnique({ where: { id: "singleton" } });
  if (existing === null) {
    await database.financeSettings.create({
      data: { id: "singleton", ...defaults, updatedById: author.id },
    });
    process.stdout.write("Development finance settings created.\n");
  } else {
    const missing = Object.fromEntries(
      Object.entries(defaults).filter(([key]) => existing[key as keyof typeof defaults] === null),
    );
    if (Object.keys(missing).length > 0) {
      await database.financeSettings.update({
        where: { id: "singleton" },
        data: { ...missing, updatedById: author.id },
      });
    }
    process.stdout.write(
      `Development finance settings: ${Object.keys(missing).length} missing fields filled.\n`,
    );
  }
} finally {
  await database.$disconnect();
}
