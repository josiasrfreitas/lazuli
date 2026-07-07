import type { GeneratedInstallment } from "@lazuli/domain";

import { notFound, STUDENT_NOT_FOUND_MESSAGE } from "./errors.js";
import type {
  FinanceBeneficiarySummary,
  FinanceInstallmentSummary,
} from "./create-order.js";
import { type FinanceDatabase, toDateOnly } from "./order-edit-cutoff.js";

export const orderSummarySelect = {
  id: true,
  payerId: true,
  kind: true,
  principalAmountCents: true,
  startDate: true,
  dueDay: true,
  signedOrderArtifactId: true,
} as const;

export const installmentSummarySelect = {
  id: true,
  orderId: true,
  amountCents: true,
  dueDate: true,
} as const;

export const beneficiarySummarySelect = {
  id: true,
  orderId: true,
  studentId: true,
} as const;

export async function assertBeneficiaryStudentsExist(
  database: FinanceDatabase,
  studentIds: string[],
): Promise<void> {
  const uniqueStudentIds = [...new Set(studentIds)];
  const foundStudents = await database.student.findMany({
    where: { id: { in: uniqueStudentIds } },
    select: { id: true },
  });

  if (foundStudents.length !== uniqueStudentIds.length) {
    throw notFound(STUDENT_NOT_FOUND_MESSAGE);
  }
}

export async function persistOrderSchedule(input: {
  database: FinanceDatabase;
  orderId: string;
  beneficiaryStudentIds: string[];
  generatedInstallments: GeneratedInstallment[];
  staffUserId: string;
}): Promise<{
  beneficiaries: FinanceBeneficiarySummary[];
  installments: FinanceInstallmentSummary[];
}> {
  const beneficiaries = await Promise.all(
    input.beneficiaryStudentIds.map((studentId) =>
      input.database.orderBeneficiary.create({
        data: {
          orderId: input.orderId,
          studentId,
          createdById: input.staffUserId,
          updatedById: input.staffUserId,
        },
        select: beneficiarySummarySelect,
      }),
    ),
  );

  const installments = await Promise.all(
    input.generatedInstallments.map((row) =>
      input.database.installment.create({
        data: {
          orderId: input.orderId,
          amountCents: row.amountCents,
          dueDate: toDateOnly(row.dueDate),
          createdById: input.staffUserId,
          updatedById: input.staffUserId,
        },
        select: installmentSummarySelect,
      }),
    ),
  );

  return { beneficiaries, installments };
}

export type LoadedEditableOrder = {
  id: string;
  installments: Array<{
    waivedAt: Date | null;
    _count: { allocations: number; adjustments: number };
  }>;
};

export async function loadEditableOrder(
  database: FinanceDatabase,
  orderId: string,
): Promise<LoadedEditableOrder | null> {
  return database.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      installments: {
        select: {
          waivedAt: true,
          _count: {
            select: {
              allocations: true,
              adjustments: true,
            },
          },
        },
      },
    },
  });
}

