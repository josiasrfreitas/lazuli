import type { Prisma } from "@lazuli/db";

const RENEWAL_DAYS = 30;

/** Same renewal window for the home queue and the student's finance action. */
export function pendingRenewalWhere(today: string): Prisma.ContractWhereInput {
  const through = new Date(today);
  through.setUTCDate(through.getUTCDate() + RENEWAL_DAYS);
  return {
    deletedAt: null,
    terminatedAt: null,
    commandId: { not: null },
    endsOn: { gte: new Date(today), lte: through },
    student: { deletedAt: null, status: "ACTIVE" },
    renewals: { none: { deletedAt: null, terminatedAt: null } },
  };
}
