import { deriveInstallmentLedger, type InstallmentLedger } from "@lazuli/domain";
import type {
  financeAddInstallmentAdjustmentInputSchema,
  financeWaiveInstallmentInputSchema,
  z,
} from "@lazuli/validators";

import {
  calculateRemainingBalanceCents,
  loadInstallments,
  lockInstallments,
  type LoadedInstallment,
} from "./payment-store.js";
import {
  ADJUSTMENT_BELOW_PAID_MESSAGE,
  ADJUSTMENT_BELOW_ZERO_MESSAGE,
  badRequest,
  CANCELLED_ORDER_INSTALLMENT_MESSAGE,
  DEFAULT_INTEREST_RATE_PCT_MONTHLY,
  DISCOUNT_REASON_REQUIRED_MESSAGE,
  INSTALLMENT_ALREADY_WAIVED_MESSAGE,
  INSTALLMENT_NOT_FOUND_MESSAGE,
  INSTALLMENT_NOTHING_TO_WAIVE_MESSAGE,
  INVALID_ADJUSTMENT_SIGN_MESSAGE,
  notFound,
  WAIVED_INSTALLMENT_ADJUSTMENT_MESSAGE,
  type FinanceDatabase,
} from "./shared.js";

export type WaiveInstallmentInput = z.infer<typeof financeWaiveInstallmentInputSchema>;
export type AddInstallmentAdjustmentInput = z.infer<
  typeof financeAddInstallmentAdjustmentInputSchema
>;

export type WaiveInstallmentResult = {
  installment: {
    id: string;
    waivedAt: Date;
    waivedReason: string;
  };
  ledger: InstallmentLedger;
};

export type InstallmentAdjustmentSummary = {
  id: string;
  installmentId: string;
  type: AddInstallmentAdjustmentInput["type"];
  amountCents: number;
  reason: string | null;
};

export type AddInstallmentAdjustmentResult = {
  adjustment: InstallmentAdjustmentSummary;
  ledger: InstallmentLedger;
};

// ---------------------------------------------------------------------------
// Waive
// ---------------------------------------------------------------------------

export async function waiveInstallment(input: {
  database: FinanceDatabase;
  values: WaiveInstallmentInput;
  staffUserId: string;
}): Promise<WaiveInstallmentResult> {
  await lockInstallments(input.database, [input.values.installmentId]);

  const installments = await loadInstallments(input.database, [input.values.installmentId]);
  const installment = installments[0];

  if (installment === undefined) {
    throw notFound(INSTALLMENT_NOT_FOUND_MESSAGE);
  }

  assertInstallmentWaivable(installment);

  const waivedAt = new Date();
  const updated = await input.database.installment.update({
    where: { id: installment.id },
    data: {
      waivedAt,
      waivedReason: input.values.reason,
      updatedById: input.staffUserId,
    },
    select: {
      id: true,
      waivedAt: true,
      waivedReason: true,
    },
  });

  if (updated.waivedAt === null || updated.waivedReason === null) {
    throw badRequest(INSTALLMENT_NOTHING_TO_WAIVE_MESSAGE);
  }

  return {
    installment: {
      id: updated.id,
      waivedAt: updated.waivedAt,
      waivedReason: updated.waivedReason,
    },
    ledger: snapshotInstallmentLedger(installment, { waivedAt: updated.waivedAt }),
  };
}

function assertInstallmentWaivable(installment: LoadedInstallment): void {
  if (installment.order.cancelledAt !== null) {
    throw badRequest(CANCELLED_ORDER_INSTALLMENT_MESSAGE);
  }

  if (installment.waivedAt !== null) {
    throw badRequest(INSTALLMENT_ALREADY_WAIVED_MESSAGE);
  }

  if (calculateRemainingBalanceCents(installment) <= 0) {
    throw badRequest(INSTALLMENT_NOTHING_TO_WAIVE_MESSAGE);
  }
}

// ---------------------------------------------------------------------------
// Adjustment
// ---------------------------------------------------------------------------

export async function addInstallmentAdjustment(input: {
  database: FinanceDatabase;
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
    case "INTEREST": {
      return amountCents > 0;
    }
    case "LATE_FEE": {
      return amountCents > 0;
    }
    case "DISCOUNT": {
      return amountCents < 0;
    }
    case "CORRECTION": {
      return amountCents !== 0;
    }
    default: {
      return false;
    }
  }
}

function snapshotInstallmentLedger(
  installment: LoadedInstallment,
  options?: { waivedAt?: Date | null },
): InstallmentLedger {
  return deriveInstallmentLedger({
    amountCents: installment.amountCents,
    dueDate: installment.dueDate,
    waivedAt: options?.waivedAt ?? installment.waivedAt,
    orderCancelledAt: installment.order.cancelledAt,
    adjustments: installment.adjustments,
    allocations: installment.allocations,
    now: new Date(),
    interestRatePctMonthly: DEFAULT_INTEREST_RATE_PCT_MONTHLY,
  });
}
