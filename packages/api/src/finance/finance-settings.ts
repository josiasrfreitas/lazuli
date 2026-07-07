import type { Prisma } from "@lazuli/db";

const FINANCE_SETTINGS_ID = "singleton";
const DEFAULT_INTEREST_RATE_PCT_MONTHLY = 1;

type FinanceSettingsDatabase = Pick<Prisma.TransactionClient, "financeSettings">;

export async function loadInterestRatePctMonthly(
  database: FinanceSettingsDatabase,
): Promise<number> {
  const settings = await database.financeSettings.findUnique({
    where: { id: FINANCE_SETTINGS_ID },
    select: { interestRatePctMonthly: true },
  });

  if (settings === null) {
    return DEFAULT_INTEREST_RATE_PCT_MONTHLY;
  }

  return Number(settings.interestRatePctMonthly);
}
