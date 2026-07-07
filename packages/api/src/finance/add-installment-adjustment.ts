import type { financeAddInstallmentAdjustmentInputSchema, z } from "@lazuli/validators";

import {
  badRequest,
  ADJUSTMENT_BELOW_PAID_MESSAGE,
  ADJUSTMENT_BELOW_ZERO_MESSAGE,
  CANCELLED_ORDER_INSTALLMENT_MESSAGE,
  DISCOUNT_REASON_REQUIRED_MESSAGE,
  INSTALLMENT_NOT_FOUND_MESSAGE,
  INVALID_ADJUSTMENT_SIGN_MESSAGE,
  notFound,
  WAIVED_INSTALLMENT_ADJUSTMENT_MESSAGE,
} from "./errors.js";
import { snapshotInstallmentLedger } from "./installment-ledger-snapshot.js";
import {
  loadInstallments,
  lockInstallments,
  type LoadedInstallment,
  type PaymentDatabase,
} from "./payment-persistence.js";

type AddInstallmentAdjustmentInput = z.infer<typeof financeAddInstallmentAdjustmentInputSchema>;

export type InstallmentAdjustmentSummary = {
  id: string;
  installmentId: string;
  type: AddInstallmentAdjustmentInput["type"];
  amountCents: number;
  reason: string | null;
};

export type AddInstallmentAdjustmentResult = {
  adjustment: InstallmentAdjustmentSummary;
  ledger: ReturnType<typeof snapshotInstallmentLedger>;
};

export async function addInstallmentAdjustment(input: {
  database: PaymentDatabase;
  values: AddInstallmentAdjustmentInput;
  staffUserId: string;
}): Promise<AddInstallmentAdjustmentResult> {
  await lockInstallments(input.database, [input.values.installmentId]);

  const installments = await loadInstallments(input.database, [input.values.installmentId]);
  const installment = installments[0];

  if (installment === undefined) {
    throw notFound(INSTALLMENT_NOT_FOUND_MESSAGE);
  }

  assertInstallmentAdjustable(installment, input.values);

  const adjustment = await input.database.installmentAdjustment.create({
    data: {
      installmentId: installment.id,
      type: input.values.type,
      amountCents: input.values.amountCents,
      reason: input.values.reason ?? null,
      createdById: input.staffUserId,
      updatedById: input.staffUserId,
    },
    select: {
      id: true,
      installmentId: true,
      type: true,
      amountCents: true,
      reason: true,
    },
  });

  const adjustedInstallment: LoadedInstallment = {
    ...installment,
    adjustments: [...installment.adjustments, { amountCents: adjustment.amountCents }],
  };

  return {
    adjustment,
    ledger: snapshotInstallmentLedger(adjustedInstallment),
  };
}

function assertInstallmentAdjustable(
  installment: LoadedInstallment,
  values: AddInstallmentAdjustmentInput,
): void {
  if (installment.order.cancelledAt !== null) {
    throw badRequest(CANCELLED_ORDER_INSTALLMENT_MESSAGE);
  }

  if (installment.waivedAt !== null) {
    throw badRequest(WAIVED_INSTALLMENT_ADJUSTMENT_MESSAGE);
  }

  if (!isValidAdjustmentSign(values.type, values.amountCents)) {
    throw badRequest(INVALID_ADJUSTMENT_SIGN_MESSAGE);
  }

  if (values.type === "DISCOUNT" && (values.reason === undefined || values.reason === null)) {
    throw badRequest(DISCOUNT_REASON_REQUIRED_MESSAGE);
  }

  const paidAmountCents = installment.allocations.reduce(
    (total, allocation) => total + allocation.amountCents,
    0,
  );
  const currentExpectedCents =
    installment.amountCents +
    installment.adjustments.reduce((total, row) => total + row.amountCents, 0) +
    values.amountCents;

  if (currentExpectedCents < 0) {
    throw badRequest(ADJUSTMENT_BELOW_ZERO_MESSAGE);
  }

  if (paidAmountCents > currentExpectedCents) {
    throw badRequest(ADJUSTMENT_BELOW_PAID_MESSAGE);
  }
}

function isValidAdjustmentSign(
  type: AddInstallmentAdjustmentInput["type"],
  amountCents: number,
): boolean {
  switch (type) {
    case "INTEREST":
    case "LATE_FEE":
      return amountCents > 0;
    case "DISCOUNT":
      return amountCents < 0;
    case "CORRECTION":
      return amountCents !== 0;
    default:
      return false;
  }
}
