import { deriveInstallmentLedger, type InstallmentLedger } from "@lazuli/domain";

import type { LoadedInstallment } from "./payment-persistence.js";

const DEFAULT_INTEREST_RATE_PCT_MONTHLY = 1;

export function snapshotInstallmentLedger(
  installment: LoadedInstallment,
  options?: {
    waivedAt?: Date | null;
    interestRatePctMonthly?: number;
  },
): InstallmentLedger {
  return deriveInstallmentLedger({
    amountCents: installment.amountCents,
    dueDate: installment.dueDate,
    waivedAt: options?.waivedAt ?? installment.waivedAt,
    orderCancelledAt: installment.order.cancelledAt,
    adjustments: installment.adjustments,
    allocations: installment.allocations,
    now: new Date(),
    interestRatePctMonthly:
      options?.interestRatePctMonthly ?? DEFAULT_INTEREST_RATE_PCT_MONTHLY,
  });
}
