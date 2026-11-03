import { type DatabaseClient } from "../../packages/db/src/client.js";
import { DEV_SYSTEM_ADMIN } from "../../packages/db/src/seed-dev-data.js";
import { INITIAL_MATERIAL_PRICING } from "../../packages/domain/src/material-pricing.js";

export async function seedSettings(database: DatabaseClient): Promise<void> {
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
    interestRatePctMonthly: "2",
    cancellationFeePct: "10",
    materialPriceCents: 12_000,
    ...INITIAL_MATERIAL_PRICING,
  };
  await database.financeSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...defaults, updatedById: author.id },
    update: { ...defaults, updatedById: author.id },
  });
  await database.paymentMethod.upsert({
    where: { code: "CREDIT" },
    create: { code: "CREDIT", name: "Crédito", sortOrder: 4, allowsExternalInstallments: true },
    update: { name: "Crédito", active: true, deletedAt: null, allowsExternalInstallments: true },
  });
  process.stdout.write("Development finance settings loaded.\n");
}
