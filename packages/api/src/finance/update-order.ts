import { generateInstallments } from "@lazuli/domain";
import type { financeUpdateOrderInputSchema, z } from "@lazuli/validators";

import { notFound, ORDER_NOT_FOUND_MESSAGE } from "./errors.js";
import type { CreateOrderResult } from "./create-order.js";
import { assertOrderEditable, type FinanceDatabase, toDateOnlyString } from "./order-edit-cutoff.js";
import {
  assertBeneficiaryStudentsExist,
  loadEditableOrder,
  orderSummarySelect,
  persistOrderSchedule,
} from "./order-persistence.js";

type UpdateOrderInput = z.infer<typeof financeUpdateOrderInputSchema>;

export async function updateOrder(input: {
  database: FinanceDatabase;
  values: UpdateOrderInput;
  updatedById: string;
}): Promise<CreateOrderResult> {
  const existingOrder = await loadEditableOrder(input.database, input.values.orderId);

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

  const schedule = await persistOrderSchedule({
    database: input.database,
    orderId: order.id,
    beneficiaryStudentIds: input.values.beneficiaryStudentIds,
    generatedInstallments,
    staffUserId: input.updatedById,
  });

  return { order, ...schedule };
}
