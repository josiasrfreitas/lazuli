import { generateInstallments, type GeneratedInstallment } from "@lazuli/domain";
import type { Order } from "@lazuli/db";
import type {
  financeCreateOrderInputSchema,
  financeUpdateOrderInputSchema,
  z,
} from "@lazuli/validators";

import { createPayer } from "./payers.js";
import {
  notFound,
  orderLocked,
  ORDER_NOT_FOUND_MESSAGE,
  PAYER_NOT_FOUND_MESSAGE,
  STUDENT_NOT_FOUND_MESSAGE,
  toDateOnly,
  toDateOnlyString,
  type FinanceDatabase,
} from "./shared.js";

export type CreateOrderInput = z.infer<typeof financeCreateOrderInputSchema>;
export type UpdateOrderInput = z.infer<typeof financeUpdateOrderInputSchema>;

export type OrderSummary = {
  id: string;
  payerId: string;
  kind: Order["kind"];
  principalAmountCents: number;
  startDate: Date;
  dueDay: number;
  signedOrderArtifactId: string | null;
};

export type InstallmentSummary = {
  sequenceNumber: number;
  id: string;
  orderId: string;
  amountCents: number;
  dueDate: Date;
};

export type OrderBeneficiarySummary = {
  id: string;
  orderId: string;
  studentId: string;
};

export type OrderScheduleResult = {
  order: OrderSummary;
  installments: InstallmentSummary[];
  beneficiaries: OrderBeneficiarySummary[];
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
  sequenceNumber: true,
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
  staffUserId: string;
}): Promise<OrderScheduleResult> {
  const payerId = await resolvePayerId(input);
  await assertBeneficiaryStudentsExist(input.database, input.values.beneficiaryStudentIds);

  const generatedInstallments = generateOrderInstallments(input.values);

  const order = await input.database.order.create({
    data: {
      payerId,
      kind: input.values.kind,
      principalAmountCents: input.values.principalAmountCents,
      startDate: input.values.startDate,
      dueDay: input.values.dueDay,
      signedOrderArtifactId: input.values.signedOrderArtifactId ?? null,
      createdById: input.staffUserId,
      updatedById: input.staffUserId,
    },
    select: orderSummarySelect,
  });

  const schedule = await persistOrderSchedule({
    database: input.database,
    orderId: order.id,
    beneficiaryStudentIds: input.values.beneficiaryStudentIds,
    generatedInstallments,
    staffUserId: input.staffUserId,
  });

  return { order, ...schedule };
}

export async function updateOrder(input: {
  database: FinanceDatabase;
  values: UpdateOrderInput;
  staffUserId: string;
}): Promise<OrderScheduleResult> {
  const existingOrder = await loadEditableOrder(input.database, input.values.orderId);

  if (existingOrder === null) {
    throw notFound(ORDER_NOT_FOUND_MESSAGE);
  }

  assertOrderEditable(existingOrder);
  await assertBeneficiaryStudentsExist(input.database, input.values.beneficiaryStudentIds);

  const generatedInstallments = generateOrderInstallments(input.values);

  const order = await input.database.order.update({
    where: { id: input.values.orderId },
    data: {
      kind: input.values.kind,
      principalAmountCents: input.values.principalAmountCents,
      startDate: input.values.startDate,
      dueDay: input.values.dueDay,
      signedOrderArtifactId: input.values.signedOrderArtifactId ?? null,
      updatedById: input.staffUserId,
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
    staffUserId: input.staffUserId,
  });

  return { order, ...schedule };
}

function generateOrderInstallments(values: {
  principalAmountCents: number;
  installmentCount: number;
  startDate: Date;
  dueDay: CreateOrderInput["dueDay"];
}): GeneratedInstallment[] {
  return generateInstallments({
    principalAmountCents: values.principalAmountCents,
    installmentCount: values.installmentCount,
    startDate: toDateOnlyString(values.startDate),
    dueDay: values.dueDay,
  });
}

async function resolvePayerId(input: {
  database: FinanceDatabase;
  values: CreateOrderInput;
  staffUserId: string;
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
    staffUserId: input.staffUserId,
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

async function persistOrderSchedule(input: {
  database: FinanceDatabase;
  orderId: string;
  beneficiaryStudentIds: string[];
  generatedInstallments: GeneratedInstallment[];
  staffUserId: string;
}): Promise<{
  beneficiaries: OrderBeneficiarySummary[];
  installments: InstallmentSummary[];
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
          sequenceNumber: row.sequenceNumber,
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

type LoadedEditableOrder = {
  id: string;
  installments: Array<{
    waivedAt: Date | null;
    _count: { allocations: number; adjustments: number };
  }>;
};

async function loadEditableOrder(
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

function assertOrderEditable(order: LoadedEditableOrder): void {
  const hasFinancialActivity = order.installments.some(
    (installment) =>
      installment.waivedAt !== null ||
      installment._count.allocations > 0 ||
      installment._count.adjustments > 0,
  );

  if (hasFinancialActivity) {
    throw orderLocked();
  }
}
