import { activityMoney } from "../activity/format.js";
import { payerSubject, orderSubject, installmentSubject } from "../activity/subjects.js";
import { activityTransaction } from "../activity/record.js";
import {
  z,
  contractTerminationPreviewSchema,
  contractTerminationConfirmSchema,
  financialTreatmentInstallmentsSchema,
  financialTreatmentPreviewSchema,
  financialTreatmentConfirmSchema,
  paymentPreviewSchema,
  paymentOperationSchema,
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
  addContractMaterialInputSchema,
  listContractsInputSchema,
  contractPartySearchInputSchema,
} from "@lazuli/validators";

import { adminProcedure, router, systemAdminProcedure } from "../trpc/init.js";
import { financialTreatments } from "./treatments/index.js";
import { finance } from "./index.js";
import { renewalTerms } from "./internal/renewal.js";

const MIN_ANALYTICS_YEAR = 2000;
const MAX_ANALYTICS_YEAR = 2100;

export const financeRouter = router({
  renewalTerms: adminProcedure
    .input(z.object({ contractId: z.string().uuid() }))
    .query(({ ctx, input }) => renewalTerms(ctx.db, input.contractId)),
  previewTermination: adminProcedure
    .input(contractTerminationPreviewSchema)
    .query(({ ctx, input }) =>
      ctx.db.$transaction(
        (tx) =>
          finance(tx, ctx.staffUser.id).previewTermination(input.contractId, ctx.now ?? new Date()),
        { isolationLevel: "RepeatableRead" },
      ),
    ),
  confirmTermination: adminProcedure
    .input(contractTerminationConfirmSchema)
    .mutation(({ ctx, input }) =>
      activityTransaction(
        ctx,
        "finance.terminateContract",
        (tx) => finance(tx, ctx.staffUser.id).confirmTermination(input, ctx.now ?? new Date()),
        async (result, db) => ({
          subject: {
            type: "contract",
            id: result.contractId,
            name: (
              await db.student.findUniqueOrThrow({
                where: { id: result.studentId },
                select: { fullName: true },
              })
            ).fullName,
          },
          description: `Multa negociada: ${input.feePct}%. Encargos mantidos: ${activityMoney(input.retainedChargesCents)}. ${input.enrollmentIds.length} matrícula(s) encerrada(s). ${input.reason}`,
          deduplicationKey: `finance.terminateContract:${input.commandId}`,
        }),
        { timeout: 30_000 },
      ),
    ),
  treatmentInstallments: adminProcedure
    .input(financialTreatmentInstallmentsSchema)
    .query(({ ctx, input }) =>
      ctx.db.$transaction(
        (tx) => financialTreatments(tx, ctx.staffUser, ctx.now ?? new Date()).available(input),
        { isolationLevel: "RepeatableRead" },
      ),
    ),
  treatmentHistory: adminProcedure
    .input(z.object({ studentId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      financialTreatments(ctx.db, ctx.staffUser, ctx.now ?? new Date()).history(input.studentId),
    ),
  previewTreatment: adminProcedure
    .input(financialTreatmentPreviewSchema)
    .query(({ ctx, input }) =>
      ctx.db.$transaction(
        (tx) => financialTreatments(tx, ctx.staffUser, ctx.now ?? new Date()).preview(input),
        { isolationLevel: "RepeatableRead" },
      ),
    ),
  confirmTreatment: adminProcedure
    .input(financialTreatmentConfirmSchema)
    .mutation(({ ctx, input }) =>
      activityTransaction(
        { ...ctx, now: ctx.now ?? new Date() },
        "finance.treatment",
        (tx) => financialTreatments(tx, ctx.staffUser, ctx.now ?? new Date()).confirm(input),
        async (result, db) => ({
          subject: input.studentId
            ? await installmentSubject(db, input.rows[0]!.installmentId)
            : { type: "receivable", name: "Tratativa em lote" },
          description: `${result.count} parcela(s). ${input.reason}`,
          deduplicationKey: `finance.treatment:${input.commandId}`,
        }),
        { timeout: 30_000 },
      ),
    ),
  studentSummary: adminProcedure
    .input(z.object({ studentId: z.string().uuid() }).strict())
    .query(({ ctx, input }) =>
      ctx.db.$transaction(
        (transaction) =>
          finance(transaction, ctx.staffUser.id).studentSummary({
            studentId: input.studentId,
            now: ctx.now ?? new Date(),
          }),
        { isolationLevel: "RepeatableRead" },
      ),
    ),
  analytics: adminProcedure
    .input(z.object({ year: z.number().int().min(MIN_ANALYTICS_YEAR).max(MAX_ANALYTICS_YEAR) }))
    .query(({ ctx, input }) =>
      ctx.db.$transaction(
        (transaction) =>
          finance(transaction, ctx.staffUser.id).analytics({
            year: input.year,
            now: ctx.now ?? new Date(),
          }),
        { isolationLevel: "RepeatableRead" },
      ),
    ),
  previewPayments: adminProcedure
    .input(paymentPreviewSchema)
    .query(({ ctx, input }) =>
      ctx.db.$transaction(
        (tx) => finance(tx, ctx.staffUser.id).previewPayments(input, ctx.now ?? new Date()),
        { isolationLevel: "RepeatableRead" },
      ),
    ),
  confirmPayments: adminProcedure.input(paymentOperationSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "finance.confirmPayments",
      (tx) => finance(tx, ctx.staffUser.id).confirmPayments(input, ctx.now ?? new Date()),
      async (result, database) => ({
        subject:
          result.length === 1
            ? await payerSubject(database, result[0]!.payerId)
            : { type: "receivable", name: `${result.length} recebimentos` },
        description: `Total recebido: ${activityMoney(result.reduce((sum, row) => sum + row.amountCents, 0))}.`,
        deduplicationKey: `finance.confirmPayments:${input.operationId}`,
      }),
    ),
  ),
  readMaterialPrice: adminProcedure.query(({ ctx }) =>
    finance(ctx.db, ctx.staffUser.id).readMaterialPrice(),
  ),
  readSettings: systemAdminProcedure.query(({ ctx }) =>
    finance(ctx.db, ctx.staffUser.id).readSettings(),
  ),
  saveSettings: systemAdminProcedure.input(financeSettingsInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "finance.saveSettings",
      (tx) => finance(tx, ctx.staffUser.id).saveSettings(input),
      () => ({ subject: { type: "school", name: "Condições financeiras da escola" } }),
    ),
  ),
  createPayer: adminProcedure.input(payerCreateProcedureInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "finance.createPayer",
      (tx) => finance(tx, ctx.staffUser.id).createPayer(input),
      (result) => ({
        subject: { type: "payer", id: result.id, name: result.name },
        deduplicationKey: `finance.createPayer:${result.id}`,
      }),
    ),
  ),
  createMonthlyContract: adminProcedure
    .input(createMonthlyContractInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await activityTransaction(
          ctx,
          "finance.createMonthlyContract",
          (tx) => finance(tx, ctx.staffUser.id).createMonthlyContract(input),
          (result) => ({
            subject: { type: "contract", id: result.id, name: result.student.fullName },
            deduplicationKey: `finance.contract:${result.id}`,
          }),
        );
      } catch (error) {
        // A concurrent retry can lose the unique-key race after the first command commits.
        const original = await finance(ctx.db, ctx.staffUser.id).findCommandResult(input);
        if (original) return original;
        throw error;
      }
    }),
  readContract: adminProcedure
    .input(z.object({ contractId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      finance(ctx.db, ctx.staffUser.id).readContract(input.contractId, ctx.now ?? new Date()),
    ),
  contractMaterialOptions: adminProcedure.query(({ ctx }) =>
    finance(ctx.db, ctx.staffUser.id).contractMaterialOptions(),
  ),
  addContractMaterial: adminProcedure
    .input(addContractMaterialInputSchema)
    .mutation(({ ctx, input }) =>
      activityTransaction(
        ctx,
        "finance.createOrder",
        (tx) => finance(tx, ctx.staffUser.id).addContractMaterial(input),
        async (result, database) => ({
          subject: await orderSubject(database, result.orderId),
          description: "Aquisição de material vinculada ao contrato.",
          deduplicationKey: `finance.createOrder:${result.orderId}`,
        }),
      ),
    ),
  listContracts: adminProcedure
    .input(listContractsInputSchema)
    .query(({ ctx, input }) =>
      finance(ctx.db, ctx.staffUser.id).listContracts({ ...input, now: ctx.now ?? new Date() }),
    ),
  searchContractParties: adminProcedure
    .input(contractPartySearchInputSchema)
    .query(({ ctx, input }) =>
      finance(ctx.db, ctx.staffUser.id).searchContractParties(input.query),
    ),
  readContractOffer: adminProcedure.query(({ ctx }) =>
    finance(ctx.db, ctx.staffUser.id).readContractOffer(),
  ),
  createOrder: adminProcedure.input(financeCreateOrderInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "finance.createOrder",
      (tx) => finance(tx, ctx.staffUser.id).createOrder(input),
      async (result, database) => ({
        subject: await orderSubject(database, result.order.id),
        description: `Valor: ${activityMoney(result.order.principalAmountCents)}.`,
        deduplicationKey: `finance.createOrder:${result.order.id}`,
      }),
    ),
  ),
  updateOrder: adminProcedure.input(financeUpdateOrderInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "finance.updateOrder",
      (tx) => finance(tx, ctx.staffUser.id).updateOrder(input),
      async (result, database) => ({
        subject: await orderSubject(database, result.order.id),
        description: `Valor: ${activityMoney(result.order.principalAmountCents)}.`,
      }),
    ),
  ),
  registerPayment: adminProcedure
    .input(financeRegisterPaymentInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await activityTransaction(
          ctx,
          "finance.registerPayment",
          (tx) => finance(tx, ctx.staffUser.id).registerPayment(input),
          async (result, database) => ({
            subject: await payerSubject(database, result.paymentEntry.payerId),
            description: `Valor recebido: ${activityMoney(result.paymentEntry.amountCents)}.`,
            deduplicationKey: `finance.registerPayment:${result.paymentEntry.id}`,
          }),
        );
      } catch (error) {
        // A concurrent submission may commit the same command first.
        const original = await finance(ctx.db, ctx.staffUser.id).findPaymentCommand(input);
        if (original) return original;
        throw error;
      }
    }),
  batchReconcile: adminProcedure
    .input(financeBatchReconcileInputSchema)
    .mutation(({ ctx, input }) =>
      activityTransaction(
        ctx,
        "finance.batchReconcile",
        (tx) => finance(tx, ctx.staffUser.id).batchReconcile(input),
        (result) =>
          result.paymentEntries.length === 0
            ? null
            : {
                subject: { type: "receivable", name: "Conciliação de pagamentos" },
                description: `${result.paymentEntries.length} recebimentos registrados.`,
                deduplicationKey: `finance.batchReconcile:${result.paymentEntries
                  .map((row) => row.id)
                  .sort()
                  .join(",")}`,
              },
      ),
    ),
  waiveInstallment: adminProcedure
    .input(financeWaiveInstallmentInputSchema)
    .mutation(({ ctx, input }) =>
      activityTransaction(
        ctx,
        "finance.waiveInstallment",
        (tx) => finance(tx, ctx.staffUser.id).waiveInstallment(input),
        async (_result, database) => ({
          subject: await installmentSubject(database, input.installmentId),
          description: input.reason,
        }),
      ),
    ),
  addInstallmentAdjustment: adminProcedure
    .input(financeAddInstallmentAdjustmentInputSchema)
    .mutation(({ ctx, input }) =>
      activityTransaction(
        ctx,
        "finance.addInstallmentAdjustment",
        (tx) => finance(tx, ctx.staffUser.id).addInstallmentAdjustment(input),
        async (_result, database) => ({
          subject: await installmentSubject(database, input.installmentId),
          description: `Ajuste: ${activityMoney(input.amountCents)}. ${input.reason ?? ""}`,
        }),
      ),
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
