import { generateInstallments } from "@lazuli/domain";
import type { financeUpdateOrderInputSchema, z } from "@lazuli/validators";

import { notFound, ORDER_NOT_FOUND_MESSAGE, STUDENT_NOT_FOUND_MESSAGE } from "./errors.js";
import type { CreateOrderResult } from "./create-order.js";
import {
  assertOrderEditable,
  type FinanceDatabase,
  toDateOnly,
  toDateOnlyString,
} from "./order-edit-cutoff.js";

type UpdateOrderInput = z.infer<typeof financeUpdateOrderInputSchema>;

const orderSummarySelect = {
  id: true,
  payerId: true,
  kind: true,
  principalAmountCents: true,
  startDate: true,
  dueDay: true,
  signedOrderArtifactId: true,
} as const;

const installmentSummarySelect = {
  id: true,
  orderId: true,
  amountCents: true,
  dueDate: true,
} as const;

const beneficiarySummarySelect = {
  id: true,
  orderId: true,
  studentId: true,
} as const;

export async function updateOrder(input: {
  database: FinanceDatabase;
  values: UpdateOrderInput;
  updatedById: string;
}): Promise<CreateOrderResult> {
  const existingOrder = await input.database.order.findUnique({
    where: { id: input.values.orderId },
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

  if (existingOrder === null) {
    throw notFound(ORDER_NOT_FOUND_MESSAGE);
  }

  assertOrderEditable(existingOrder);
  await assertBeneficiaryStudentsExist(input.database, input.values.beneficiaryStudentIds);

  const generatedInstallments = generateInstallments({
    principalAmountCents: input.values.principalAmountCents,
    installmentCount: input.values.installmentCount,
    startDate: toDateOnlyString(input.values.startDate),
    dueDay: input.values.dueDay,
  });

  const order = await input.database.order.update({
    where: { id: input.values.orderId },
    data: {
      kind: input.values.kind,
      principalAmountCents: input.values.principalAmountCents,
      startDate: input.values.startDate,
      dueDay: input.values.dueDay,
      signedOrderArtifactId: input.values.signedOrderArtifactId ?? null,
      updatedById: input.updatedById,
    },
    select: orderSummarySelect,
  });

  await input.database.installment.deleteMany({ where: { orderId: order.id } });
  await input.database.orderBeneficiary.deleteMany({ where: { orderId: order.id } });

  const beneficiaries = await Promise.all(
    input.values.beneficiaryStudentIds.map((studentId) =>
      input.database.orderBeneficiary.create({
        data: {
          orderId: order.id,
          studentId,
          createdById: input.updatedById,
          updatedById: input.updatedById,
        },
        select: beneficiarySummarySelect,
      }),
    ),
  );

  const installments = await Promise.all(
    generatedInstallments.map((row) =>
      input.database.installment.create({
        data: {
          orderId: order.id,
          amountCents: row.amountCents,
          dueDate: toDateOnly(row.dueDate),
          createdById: input.updatedById,
          updatedById: input.updatedById,
        },
        select: installmentSummarySelect,
      }),
    ),
  );

  return {
    order,
    installments,
    beneficiaries,
  };
}

async function assertBeneficiaryStudentsExist(
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
