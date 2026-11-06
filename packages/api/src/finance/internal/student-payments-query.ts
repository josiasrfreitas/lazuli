import type { Prisma } from "@lazuli/db";

export function studentPaymentWhere(studentId: string): Prisma.PaymentEntryWhereInput {
  return {
    deletedAt: null,
    allocations: { some: studentPaymentAllocationWhere(studentId) },
  };
}

export function studentPaymentAllocationWhere(
  studentId: string,
): Prisma.PaymentAllocationWhereInput {
  return {
    deletedAt: null,
    installment: {
      order: {
        OR: [
          { contract: { studentId } },
          { beneficiaries: { some: { studentId, deletedAt: null } } },
        ],
      },
    },
  };
}
