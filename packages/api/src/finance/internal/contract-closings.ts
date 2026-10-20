import type { FinanceDatabase } from "./shared.js";

const MONTHS_IN_YEAR = 12;
const MONTH_KEY_LENGTH = 7;
export type ContractClosingMonth = {
  month: string;
  count: number;
  projectedCents: number;
  monthlyEquivalentCents: number;
};
export type ContractClosings = { months: ContractClosingMonth[]; incompleteCount: number };

/** Commercial bookings use the agreement date and original nominal terms, independently of cash. */
export async function readContractClosings(
  database: FinanceDatabase,
  input: { year: number; asOf: string },
): Promise<ContractClosings> {
  const contracts = await database.contract.findMany({
    where: {
      deletedAt: null,
      agreedOn: {
        gte: new Date(`${input.year}-01-01`),
        lt: new Date(`${input.year + 1}-01-01`),
        lte: new Date(input.asOf),
      },
    },
    select: { agreedOn: true, monthlyAmountCents: true, durationMonths: true },
  });
  const months: ContractClosingMonth[] = Array.from(
    { length: MONTHS_IN_YEAR },
    (_value, index) => ({
      month: `${input.year}-${String(index + 1).padStart(2, "0")}`,
      count: 0,
      projectedCents: 0,
      monthlyEquivalentCents: 0,
    }),
  );
  let incompleteCount = 0;
  for (const contract of contracts) {
    const month = months.find(
      (row) => row.month === contract.agreedOn?.toISOString().slice(0, MONTH_KEY_LENGTH),
    );
    if (!month) continue;
    month.count++;
    if (
      contract.monthlyAmountCents === null ||
      contract.durationMonths === null ||
      contract.durationMonths < 1
    ) {
      incompleteCount++;
      continue;
    }
    month.monthlyEquivalentCents += contract.monthlyAmountCents;
    month.projectedCents += contract.monthlyAmountCents * contract.durationMonths;
  }
  return { months, incompleteCount };
}
