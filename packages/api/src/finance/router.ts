import {
  financeAddInstallmentAdjustmentInputSchema,
  financeBatchReconcileInputSchema,
  financeCreateOrderInputSchema,
  financeRegisterPaymentInputSchema,
  financeUpdateOrderInputSchema,
  financeWaiveInstallmentInputSchema,
  payerCreateProcedureInputSchema,
} from "@lazuli/validators";

import { adminProcedure, router } from "../trpc/init.js";
import { addInstallmentAdjustment } from "./add-installment-adjustment.js";
import { batchReconcile } from "./batch-reconcile.js";
import { createOrder } from "./create-order.js";
import { createPayer } from "./create-payer.js";
import { overdueList } from "./overdue-list.js";
import { receivablesSnapshot } from "./receivables-snapshot.js";
import { registerPayment } from "./register-payment.js";
import { updateOrder } from "./update-order.js";
import { waiveInstallment } from "./waive-installment.js";

export const financeRouter = router({
  createPayer: adminProcedure.input(payerCreateProcedureInputSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      createPayer({
        database,
        values: input,
        createdById: ctx.staffUser.id,
      }),
    ),
  ),
  createOrder: adminProcedure.input(financeCreateOrderInputSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      createOrder({
        database,
        values: input,
        createdById: ctx.staffUser.id,
      }),
    ),
  ),
  updateOrder: adminProcedure.input(financeUpdateOrderInputSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      updateOrder({
        database,
        values: input,
        updatedById: ctx.staffUser.id,
      }),
    ),
  ),
  registerPayment: adminProcedure
    .input(financeRegisterPaymentInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        registerPayment({
          database,
          values: input,
          staffUserId: ctx.staffUser.id,
        }),
      ),
    ),
  batchReconcile: adminProcedure
    .input(financeBatchReconcileInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        batchReconcile({
          database,
          values: input,
          staffUserId: ctx.staffUser.id,
        }),
      ),
    ),
  waiveInstallment: adminProcedure
    .input(financeWaiveInstallmentInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        waiveInstallment({
          database,
          values: input,
          staffUserId: ctx.staffUser.id,
        }),
      ),
    ),
  addInstallmentAdjustment: adminProcedure
    .input(financeAddInstallmentAdjustmentInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        addInstallmentAdjustment({
          database,
          values: input,
          staffUserId: ctx.staffUser.id,
        }),
      ),
    ),
  receivablesSnapshot: adminProcedure.query(({ ctx }) => receivablesSnapshot({ database: ctx.db })),
  overdueList: adminProcedure.query(({ ctx }) => overdueList({ database: ctx.db })),
});
