import { generateInstallments } from "@lazuli/domain";
import type { Order } from "@lazuli/db";
import type { financeCreateOrderInputSchema, z } from "@lazuli/validators";

import { createPayer } from "./create-payer.js";
import { notFound, PAYER_NOT_FOUND_MESSAGE, STUDENT_NOT_FOUND_MESSAGE } from "./errors.js";
import {
  type FinanceDatabase,
  toDateOnly,
  toDateOnlyString,
} from "./order-edit-cutoff.js";

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

  const beneficiaries = await Promise.all(
    input.values.beneficiaryStudentIds.map((studentId) =>
      input.database.orderBeneficiary.create({
        data: {
          orderId: order.id,
          studentId,
          createdById: input.createdById,
          updatedById: input.createdById,
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
          createdById: input.createdById,
          updatedById: input.createdById,
        },
        select: installmentSummarySelect,
      }),
    ),
  );

  return { order, installments, beneficiaries };
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
