import type { Prisma } from "@lazuli/db";

import { orderLocked } from "./errors.js";

type InstallmentActivityRow = {
  waivedAt: Date | null;
  _count: {
    allocations: number;
    adjustments: number;
  };
};

export type OrderEditSnapshot = {
  installments: InstallmentActivityRow[];
};

export function assertOrderEditable(order: OrderEditSnapshot): void {
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

export type FinanceDatabase = Pick<
  Prisma.TransactionClient,
  "payer" | "order" | "orderBeneficiary" | "installment" | "student"
>;

export function toDateOnlyString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
