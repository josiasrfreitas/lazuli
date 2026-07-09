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
import { receivables } from "./index.js";

export const financeRouter = router({
  createPayer: adminProcedure
    .input(payerCreateProcedureInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) => receivables(tx, ctx.staffUser.id).createPayer(input)),
    ),
  createOrder: adminProcedure
    .input(financeCreateOrderInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) => receivables(tx, ctx.staffUser.id).createOrder(input)),
    ),
  updateOrder: adminProcedure
    .input(financeUpdateOrderInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) => receivables(tx, ctx.staffUser.id).updateOrder(input)),
    ),
  registerPayment: adminProcedure
    .input(financeRegisterPaymentInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) => receivables(tx, ctx.staffUser.id).registerPayment(input)),
    ),
  batchReconcile: adminProcedure
    .input(financeBatchReconcileInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) => receivables(tx, ctx.staffUser.id).batchReconcile(input)),
    ),
  waiveInstallment: adminProcedure
    .input(financeWaiveInstallmentInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) => receivables(tx, ctx.staffUser.id).waiveInstallment(input)),
    ),
  addInstallmentAdjustment: adminProcedure
    .input(financeAddInstallmentAdjustmentInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) =>
        receivables(tx, ctx.staffUser.id).addInstallmentAdjustment(input),
      ),
    ),
  receivablesSnapshot: adminProcedure.query(({ ctx }) =>
    receivables(ctx.db, ctx.staffUser.id).receivablesSnapshot(),
  ),
  overdueList: adminProcedure.query(({ ctx }) =>
    receivables(ctx.db, ctx.staffUser.id).overdueList(),
  ),
});
