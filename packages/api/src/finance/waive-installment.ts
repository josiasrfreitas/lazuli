import type { financeWaiveInstallmentInputSchema, z } from "@lazuli/validators";

import {
  badRequest,
  CANCELLED_ORDER_INSTALLMENT_MESSAGE,
  INSTALLMENT_ALREADY_WAIVED_MESSAGE,
  INSTALLMENT_NOT_FOUND_MESSAGE,
  INSTALLMENT_NOTHING_TO_WAIVE_MESSAGE,
  notFound,
} from "./errors.js";
import { snapshotInstallmentLedger } from "./installment-ledger-snapshot.js";
import {
  calculateRemainingBalanceCents,
  loadInstallments,
  lockInstallments,
  type LoadedInstallment,
  type PaymentDatabase,
} from "./payment-persistence.js";

type WaiveInstallmentInput = z.infer<typeof financeWaiveInstallmentInputSchema>;

export type WaiveInstallmentResult = {
  installment: {
    id: string;
    waivedAt: Date;
    waivedReason: string;
  };
  ledger: ReturnType<typeof snapshotInstallmentLedger>;
};

export async function waiveInstallment(input: {
  database: PaymentDatabase;
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
