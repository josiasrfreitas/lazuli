import { generateInstallments } from "@lazuli/domain";
import type { Order } from "@lazuli/db";
import type { financeCreateOrderInputSchema, z } from "@lazuli/validators";

import { createPayer } from "./create-payer.js";
import { notFound, PAYER_NOT_FOUND_MESSAGE } from "./errors.js";
import { type FinanceDatabase, toDateOnlyString } from "./order-edit-cutoff.js";
import {
  assertBeneficiaryStudentsExist,
  orderSummarySelect,
  persistOrderSchedule,
} from "./order-persistence.js";

type CreateOrderInput = z.infer<typeof financeCreateOrderInputSchema>;

export type FinanceOrderSummary = {
  id: string;
  payerId: string;
  kind: Order["kind"];
  principalAmountCents: number;
  startDate: Date;
  dueDay: number;
  signedOrderArtifactId: string | null;
};

export type FinanceInstallmentSummary = {
  id: string;
  orderId: string;
  amountCents: number;
  dueDate: Date;
};

export type FinanceBeneficiarySummary = {
  id: string;
  orderId: string;
  studentId: string;
};

export type CreateOrderResult = {
  order: FinanceOrderSummary;
  installments: FinanceInstallmentSummary[];
  beneficiaries: FinanceBeneficiarySummary[];
};

export async function createOrder(input: {
  database: FinanceDatabase;
  values: CreateOrderInput;
  createdById: string;
}): Promise<CreateOrderResult> {
  const payerId = await resolvePayerId(input);
  await assertBeneficiaryStudentsExist(input.database, input.values.beneficiaryStudentIds);

  const generatedInstallments = generateInstallments({
    principalAmountCents: input.values.principalAmountCents,
    installmentCount: input.values.installmentCount,
    startDate: toDateOnlyString(input.values.startDate),
    dueDay: input.values.dueDay,
  });

  const order = await input.database.order.create({
    data: {
      payerId,
      kind: input.values.kind,
      principalAmountCents: input.values.principalAmountCents,
      startDate: input.values.startDate,
      dueDay: input.values.dueDay,
      signedOrderArtifactId: input.values.signedOrderArtifactId ?? null,
      createdById: input.createdById,
      updatedById: input.createdById,
    },
    select: orderSummarySelect,
  });

  const schedule = await persistOrderSchedule({
    database: input.database,
    orderId: order.id,
    beneficiaryStudentIds: input.values.beneficiaryStudentIds,
    generatedInstallments,
    staffUserId: input.createdById,
  });

  return { order, ...schedule };
}

async function resolvePayerId(input: {
  database: FinanceDatabase;
  values: CreateOrderInput;
  createdById: string;
}): Promise<string> {
  if (input.values.payer.mode === "existing") {
    const payer = await input.database.payer.findUnique({
      where: { id: input.values.payer.payerId },
      select: { id: true },
    });

    if (payer === null) {
      throw notFound(PAYER_NOT_FOUND_MESSAGE);
    }

    return payer.id;
  }

  const payer = await createPayer({
    database: input.database,
    values: input.values.payer,
    createdById: input.createdById,
  });

  return payer.id;
}
