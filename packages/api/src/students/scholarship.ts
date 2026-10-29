import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";

/** Scholarship is a commercial condition, independent of enrollment status. */
export function currentScholarshipContractWhere(now: Date): Prisma.ContractWhereInput {
  const today = new Date(saoPauloDateOnly(now));
  return {
    deletedAt: null,
    terminatedAt: null,
    startsOn: { lte: today },
    endsOn: { gte: today },
    OR: [
      { scholarshipPct: { gt: 0 } },
      {
        orders: {
          some: { deletedAt: null, cancelledAt: null, material: { scholarshipPct: { gt: 0 } } },
        },
      },
    ],
  };
}
