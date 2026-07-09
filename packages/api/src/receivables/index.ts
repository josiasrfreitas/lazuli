import { batchReconcile, type BatchReconcileResult } from "./internal/batch-reconcile.js";
import {
  addInstallmentAdjustment,
  waiveInstallment,
  type AddInstallmentAdjustmentResult,
  type WaiveInstallmentResult,
} from "./internal/installment-actions.js";
import {
  overdueList,
  receivablesSnapshot,
  type OverdueListResult,
} from "./internal/ledger-read.js";
import { createOrder, updateOrder, type OrderScheduleResult } from "./internal/orders.js";
import { createPayer } from "./internal/payers.js";
import { registerPayment, type RegisterPaymentResult } from "./internal/register-payment.js";
import type { ReceivablesDatabase } from "./internal/shared.js";
import type { Payer } from "@lazuli/db";
import type { ReceivablesSnapshot } from "@lazuli/domain";
import type {
  financeAddInstallmentAdjustmentInputSchema,
  financeBatchReconcileInputSchema,
  financeCreateOrderInputSchema,
  financeRegisterPaymentInputSchema,
  financeUpdateOrderInputSchema,
  financeWaiveInstallmentInputSchema,
  payerCreateProcedureInputSchema,
  z,
} from "@lazuli/validators";

/**
 * The receivables module: the single deep interface over the payer → order →
 * installment → payment → dashboard chain. tRPC procedures in ./router.ts are
 * its only callers; installment generation, ledger derivation, and dashboard
 * aggregation are implementation details behind ./internal. See D-0037.
 *
 * `db` may be a full PrismaClient (read paths) or a transaction client (mutations);
 * the router opens the transaction so the whole operation commits atomically.
 * `staffUserId` is the acting admin, stamped onto created/updated rows.
 */
export function receivables(db: ReceivablesDatabase, staffUserId: string): ReceivablesModule {
  return {
    createPayer: (values) => createPayer({ database: db, values, staffUserId }),
    createOrder: (values) => createOrder({ database: db, values, staffUserId }),
    updateOrder: (values) => updateOrder({ database: db, values, staffUserId }),
    registerPayment: (values) => registerPayment({ database: db, values, staffUserId }),
    batchReconcile: (values) => batchReconcile({ database: db, values, staffUserId }),
    waiveInstallment: (values) => waiveInstallment({ database: db, values, staffUserId }),
    addInstallmentAdjustment: (values) =>
      addInstallmentAdjustment({ database: db, values, staffUserId }),
    receivablesSnapshot: () => receivablesSnapshot(db),
    overdueList: () => overdueList(db),
  };
}

export type ReceivablesModule = {
  createPayer: (values: z.infer<typeof payerCreateProcedureInputSchema>) => Promise<Payer>;
  createOrder: (
    values: z.infer<typeof financeCreateOrderInputSchema>,
  ) => Promise<OrderScheduleResult>;
  updateOrder: (
    values: z.infer<typeof financeUpdateOrderInputSchema>,
  ) => Promise<OrderScheduleResult>;
  registerPayment: (
    values: z.infer<typeof financeRegisterPaymentInputSchema>,
  ) => Promise<RegisterPaymentResult>;
  batchReconcile: (
    values: z.infer<typeof financeBatchReconcileInputSchema>,
  ) => Promise<BatchReconcileResult>;
  waiveInstallment: (
    values: z.infer<typeof financeWaiveInstallmentInputSchema>,
  ) => Promise<WaiveInstallmentResult>;
  addInstallmentAdjustment: (
    values: z.infer<typeof financeAddInstallmentAdjustmentInputSchema>,
  ) => Promise<AddInstallmentAdjustmentResult>;
  receivablesSnapshot: () => Promise<ReceivablesSnapshot>;
  overdueList: () => Promise<OverdueListResult>;
};

export type { BatchReconcileResult } from "./internal/batch-reconcile.js";
export type {
  AddInstallmentAdjustmentResult,
  WaiveInstallmentResult,
} from "./internal/installment-actions.js";
export type { OverdueListResult } from "./internal/ledger-read.js";
export type { OrderScheduleResult } from "./internal/orders.js";
export type { RegisterPaymentResult } from "./internal/register-payment.js";

export {
  ADJUSTMENT_BELOW_PAID_MESSAGE,
  ADJUSTMENT_BELOW_ZERO_MESSAGE,
  CANCELLED_ORDER_INSTALLMENT_MESSAGE,
  DISCOUNT_REASON_REQUIRED_MESSAGE,
  ENTRY_OVER_ALLOCATION_MESSAGE,
  INSTALLMENT_ALREADY_WAIVED_MESSAGE,
  INSTALLMENT_NOT_FOUND_MESSAGE,
  INSTALLMENT_NOTHING_TO_WAIVE_MESSAGE,
  INSTALLMENT_OVER_ALLOCATION_MESSAGE,
  INSTALLMENT_PAYER_MISMATCH_MESSAGE,
  INVALID_ADJUSTMENT_SIGN_MESSAGE,
  ORDER_LOCKED_MESSAGE,
  ORDER_NOT_FOUND_MESSAGE,
  PAYER_NOT_FOUND_MESSAGE,
  STUDENT_NOT_FOUND_MESSAGE,
  WAIVED_INSTALLMENT_ADJUSTMENT_MESSAGE,
  WAIVED_INSTALLMENT_ALLOCATION_MESSAGE,
} from "./internal/shared.js";
