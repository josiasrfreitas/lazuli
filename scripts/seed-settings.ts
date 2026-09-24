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
  // An existing configuration, including its author and timestamp, is never overwritten.
  const result = await database.financeSettings.createMany({
    data: [
      {
        id: "singleton",
        tuitionCeilingCents: 25_000,
        maximumDiscountPct: "20",
        interestRatePctDaily: "0.1",
        interestRatePctMonthly: "2",
        cancellationFeePct: "10",
        materialPriceCents: 12_000,
        updatedById: author.id,
      },
    ],
    skipDuplicates: true,
  });
  process.stdout.write(
    result.count === 0
      ? "Existing finance settings preserved.\n"
      : "Development finance settings created.\n",
  );
} finally {
  await database.$disconnect();
}
