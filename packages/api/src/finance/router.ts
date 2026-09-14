import {
  financeAddInstallmentAdjustmentInputSchema,
  financeBatchReconcileInputSchema,
  financeCreateOrderInputSchema,
  financeInstallmentsInputSchema,
  financeInstallmentsOutputSchema,
  financeRegisterPaymentInputSchema,
  financeUpdateOrderInputSchema,
  financeWaiveInstallmentInputSchema,
  payerCreateProcedureInputSchema,
} from "@lazuli/validators";

import { adminProcedure, router } from "../trpc/init.js";
import { finance } from "./index.js";

export const financeRouter = router({
  createPayer: adminProcedure
    .input(payerCreateProcedureInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) => finance(tx, ctx.staffUser.id).createPayer(input)),
    ),
  createOrder: adminProcedure
    .input(financeCreateOrderInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) => finance(tx, ctx.staffUser.id).createOrder(input)),
    ),
  updateOrder: adminProcedure
    .input(financeUpdateOrderInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) => finance(tx, ctx.staffUser.id).updateOrder(input)),
    ),
  registerPayment: adminProcedure
    .input(financeRegisterPaymentInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) => finance(tx, ctx.staffUser.id).registerPayment(input)),
    ),
  batchReconcile: adminProcedure
    .input(financeBatchReconcileInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) => finance(tx, ctx.staffUser.id).batchReconcile(input)),
    ),
  waiveInstallment: adminProcedure
    .input(financeWaiveInstallmentInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) => finance(tx, ctx.staffUser.id).waiveInstallment(input)),
    ),
  addInstallmentAdjustment: adminProcedure
    .input(financeAddInstallmentAdjustmentInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) => finance(tx, ctx.staffUser.id).addInstallmentAdjustment(input)),
    ),
  receivablesSnapshot: adminProcedure.query(({ ctx }) =>
    finance(ctx.db, ctx.staffUser.id).receivablesSnapshot(),
  ),
  overdueList: adminProcedure.query(({ ctx }) => finance(ctx.db, ctx.staffUser.id).overdueList()),
  installments: adminProcedure
    .input(financeInstallmentsInputSchema)
    .output(financeInstallmentsOutputSchema)
    .query(({ ctx, input }) => {
      const now = ctx.now ?? new Date();
      return ctx.db.$transaction(
        (transaction) => finance(transaction, ctx.staffUser.id).installments(input, now),
        { isolationLevel: "RepeatableRead" },
      );
    }),
});
