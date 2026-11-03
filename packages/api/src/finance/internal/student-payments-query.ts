import type { Prisma } from "@lazuli/db";

export function studentPaymentWhere(studentId: string): Prisma.PaymentEntryWhereInput {
  return {
    deletedAt: null,
    allocations: {
      some: {
        deletedAt: null,
        installment: {
          order: {
            OR: [
              { contract: { studentId } },
              { beneficiaries: { some: { studentId, deletedAt: null } } },
            ],
          },
        },
      },
    },
  };
}
