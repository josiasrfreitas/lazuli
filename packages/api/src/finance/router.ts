import {
  financeAddInstallmentAdjustmentInputSchema,
  financeBatchReconcileInputSchema,
  financeCreateOrderInputSchema,
  financeInstallmentsInputSchema,
  financeInstallmentsOutputSchema,
  financeRegisterPaymentInputSchema,
  financeSettingsInputSchema,
  financeUpdateOrderInputSchema,
  financeWaiveInstallmentInputSchema,
  payerCreateProcedureInputSchema,
  createMonthlyContractInputSchema,
  listContractsInputSchema,
  contractPartySearchInputSchema,
} from "@lazuli/validators";

import { adminProcedure, router, systemAdminProcedure } from "../trpc/init.js";
import { finance } from "./index.js";

export const financeRouter = router({
  readSettings: systemAdminProcedure.query(({ ctx }) =>
    finance(ctx.db, ctx.staffUser.id).readSettings(),
  ),
  saveSettings: systemAdminProcedure
    .input(financeSettingsInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) => finance(tx, ctx.staffUser.id).saveSettings(input)),
    ),
  createPayer: adminProcedure
    .input(payerCreateProcedureInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) => finance(tx, ctx.staffUser.id).createPayer(input)),
    ),
  createMonthlyContract: adminProcedure
    .input(createMonthlyContractInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.$transaction((tx) =>
          finance(tx, ctx.staffUser.id).createMonthlyContract(input),
        );
      } catch (error) {
        // A concurrent retry can lose the unique-key race after the first command commits.
        const original = await finance(ctx.db, ctx.staffUser.id).findCommandResult(input);
        if (original) return original;
        throw error;
      }
    }),
  listContracts: adminProcedure
    .input(listContractsInputSchema)
    .query(({ ctx, input }) => finance(ctx.db, ctx.staffUser.id).listContracts(input.page)),
  searchContractParties: adminProcedure
    .input(contractPartySearchInputSchema)
    .query(({ ctx, input }) =>
      finance(ctx.db, ctx.staffUser.id).searchContractParties(input.query),
    ),
  readContractOffer: adminProcedure.query(({ ctx }) =>
    finance(ctx.db, ctx.staffUser.id).readContractOffer(),
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
