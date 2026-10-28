import { activityMoney } from "../activity/format.js";
import { payerSubject, orderSubject, installmentSubject } from "../activity/subjects.js";
import { activityTransaction } from "../activity/record.js";
import {
  contractClosingsInputSchema,
  z,
  contractTerminationPreviewSchema,
  contractTerminationConfirmSchema,
  contractRenegotiationPreviewSchema,
  contractRenegotiationConfirmSchema,
  paymentPreviewSchema,
  paymentOperationSchema,
  financeAddInstallmentAdjustmentInputSchema,
  financeBatchReconcileInputSchema,
  financeCreateOrderInputSchema,
  financeInstallmentsInputSchema,
  financeStudentSummaryInputSchema,
  financialTreatmentInstallmentsSchema,
  financialTreatmentPreviewSchema,
  financialTreatmentConfirmSchema,
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
import { finance } from "./index.js";
import { studentPayments } from "./payment-proofs.js";
import { renewalTerms } from "./internal/renewal.js";

const AGREEMENT_TRANSACTION_TIMEOUT_MS = 30_000;

export const financeRouter = router({
  studentPayments: adminProcedure
    .input(z.object({ studentId: z.string().uuid(), cursor: z.string().uuid().optional() }))
    .query(({ ctx, input }) => studentPayments(ctx, input)),
  paymentMethods: adminProcedure.query(({ ctx }) =>
    ctx.db.paymentMethod.findMany({
      where: { active: true, deletedAt: null },
      select: { id: true, code: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ),
  renegotiationOptions: adminProcedure
    .input(contractTerminationPreviewSchema)
    .query(({ ctx, input }) =>
      ctx.db.$transaction(
        (tx) =>
          finance(tx, ctx.staffUser.id).renegotiationOptions(
            input.contractId,
            ctx.now ?? new Date(),
          ),
        { isolationLevel: "RepeatableRead" },
      ),
    ),
  previewRenegotiation: adminProcedure
    .input(contractRenegotiationPreviewSchema)
    .query(({ ctx, input }) =>
      ctx.db.$transaction(
        (tx) => finance(tx, ctx.staffUser.id).previewRenegotiation(input, ctx.now ?? new Date()),
        {
          isolationLevel: "RepeatableRead",
        },
      ),
    ),
  confirmRenegotiation: adminProcedure
    .input(contractRenegotiationConfirmSchema)
    .mutation(({ ctx, input }) =>
      activityTransaction(ctx, {
        action: "finance.renegotiateContract",
        work: (tx) =>
          finance(tx, ctx.staffUser.id).confirmRenegotiation(input, {
            actorName: ctx.staffUser.name,
            now: ctx.now ?? new Date(),
          }),
        describe: async (result, db) => {
          const contract = await db.contract.findUniqueOrThrow({
            where: { id: result.contractId },
            include: { student: true },
          });
          return {
            subject: { type: "contract", id: result.contractId, name: contract.student.fullName },
            description: `${result.count} parcela(s) renegociada(s). Redução: ${activityMoney(result.reductionCents)}. ${input.reason}`,
            deduplicationKey: `finance.renegotiateContract:${input.commandId}`,
          };
        },
        options: { timeout: AGREEMENT_TRANSACTION_TIMEOUT_MS },
      }),
    ),
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
      activityTransaction(ctx, {
        action: "finance.terminateContract",
        work: (tx) =>
          finance(tx, ctx.staffUser.id).confirmTermination(input, ctx.now ?? new Date()),
        describe: async (result, db) => {
          const student = await db.student.findUniqueOrThrow({
            where: { id: result.studentId },
            select: { fullName: true },
          });
          return {
            subject: {
              type: "contract",
              id: result.contractId,
              name: student.fullName,
            },
            description: `Multa negociada: ${input.feePct}%. Encargos mantidos: ${activityMoney(input.retainedChargesCents)}. ${input.enrollmentIds.length} matrícula(s) encerrada(s). ${input.reason}`,
            deduplicationKey: `finance.terminateContract:${input.commandId}`,
          };
        },
        options: { timeout: 30_000 },
      }),
    ),
  treatmentInstallments: adminProcedure
    .input(financialTreatmentInstallmentsSchema)
    .query(({ ctx, input }) =>
      ctx.db.$transaction(
        (transaction) =>
          finance(transaction, ctx.staffUser.id).treatmentInstallments(
            input,
            ctx.now ?? new Date(),
          ),
        { isolationLevel: "RepeatableRead" },
      ),
    ),
  treatmentHistory: adminProcedure
    .input(financeStudentSummaryInputSchema)
    .query(({ ctx, input }) => finance(ctx.db, ctx.staffUser.id).treatmentHistory(input.studentId)),
  previewTreatment: adminProcedure
    .input(financialTreatmentPreviewSchema)
    .query(({ ctx, input }) =>
      ctx.db.$transaction(
        (transaction) =>
          finance(transaction, ctx.staffUser.id).previewTreatment(input, ctx.now ?? new Date()),
        { isolationLevel: "RepeatableRead" },
      ),
    ),
  confirmTreatment: adminProcedure
    .input(financialTreatmentConfirmSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(
        (transaction) =>
          finance(transaction, ctx.staffUser.id).confirmTreatment(input, {
            actorName: ctx.staffUser.name,
            now: ctx.now ?? new Date(),
          }),
        { timeout: AGREEMENT_TRANSACTION_TIMEOUT_MS },
      ),
    ),
  studentSummary: adminProcedure.input(financeStudentSummaryInputSchema).query(({ ctx, input }) =>
    ctx.db.$transaction(
      (transaction) =>
        finance(transaction, ctx.staffUser.id).studentSummary({
          studentId: input.studentId,
          now: ctx.now ?? new Date(),
        }),
      { isolationLevel: "RepeatableRead" },
    ),
  ),
  analytics: adminProcedure.input(contractClosingsInputSchema).query(({ ctx, input }) =>
    ctx.db.$transaction(
      (transaction) =>
        finance(transaction, ctx.staffUser.id).analytics({
          year: input.year,
          now: ctx.now ?? new Date(),
        }),
      { isolationLevel: "RepeatableRead" },
    ),
  ),
  contractClosings: adminProcedure
    .input(contractClosingsInputSchema)
    .query(({ ctx, input }) =>
      finance(ctx.db, ctx.staffUser.id).contractClosings(input.year, ctx.now ?? new Date()),
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
    activityTransaction(ctx, {
      action: "finance.confirmPayments",
      work: (tx) => finance(tx, ctx.staffUser.id).confirmPayments(input, ctx.now ?? new Date()),
      describe: async (result, database) => ({
        subject:
          result.length === 1
            ? await payerSubject(database, result[0]!.payerId)
            : { type: "receivable", name: `${result.length} recebimentos` },
        description: `Total recebido: ${activityMoney(result.reduce((sum, row) => sum + row.amountCents, 0))}.`,
        deduplicationKey: `finance.confirmPayments:${input.operationId}`,
      }),
    }),
  ),
  readMaterialPrice: adminProcedure.query(({ ctx }) =>
    finance(ctx.db, ctx.staffUser.id).readMaterialPrice(),
  ),
  readSettings: systemAdminProcedure.query(({ ctx }) =>
    finance(ctx.db, ctx.staffUser.id).readSettings(),
  ),
  saveSettings: systemAdminProcedure.input(financeSettingsInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(ctx, {
      action: "finance.saveSettings",
      work: (tx) => finance(tx, ctx.staffUser.id).saveSettings(input),
      describe: () => ({ subject: { type: "school", name: "Condições financeiras da escola" } }),
    }),
  ),
  createPayer: adminProcedure.input(payerCreateProcedureInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(ctx, {
      action: "finance.createPayer",
      work: (tx) => finance(tx, ctx.staffUser.id).createPayer(input),
      describe: (result) => ({
        subject: { type: "payer", id: result.id, name: result.name },
        deduplicationKey: `finance.createPayer:${result.id}`,
      }),
    }),
  ),
  createMonthlyContract: adminProcedure
    .input(createMonthlyContractInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await activityTransaction(ctx, {
          action: "finance.createMonthlyContract",
          work: (tx) => finance(tx, ctx.staffUser.id).createMonthlyContract(input),
          describe: (result) => ({
            subject: { type: "contract", id: result.id, name: result.student.fullName },
            deduplicationKey: `finance.contract:${result.id}`,
          }),
        });
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
      activityTransaction(ctx, {
        action: "finance.createOrder",
        work: (tx) => finance(tx, ctx.staffUser.id).addContractMaterial(input),
        describe: async (result, database) => ({
          subject: await orderSubject(database, result.orderId),
          description: "Aquisição de material vinculada ao contrato.",
          deduplicationKey: `finance.createOrder:${result.orderId}`,
        }),
      }),
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
    activityTransaction(ctx, {
      action: "finance.createOrder",
      work: (tx) => finance(tx, ctx.staffUser.id).createOrder(input),
      describe: async (result, database) => ({
        subject: await orderSubject(database, result.order.id),
        description: `Valor: ${activityMoney(result.order.principalAmountCents)}.`,
        deduplicationKey: `finance.createOrder:${result.order.id}`,
      }),
    }),
  ),
  updateOrder: adminProcedure.input(financeUpdateOrderInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(ctx, {
      action: "finance.updateOrder",
      work: (tx) => finance(tx, ctx.staffUser.id).updateOrder(input),
      describe: async (result, database) => ({
        subject: await orderSubject(database, result.order.id),
        description: `Valor: ${activityMoney(result.order.principalAmountCents)}.`,
      }),
    }),
  ),
  registerPayment: adminProcedure
    .input(financeRegisterPaymentInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await activityTransaction(ctx, {
          action: "finance.registerPayment",
          work: (tx) => finance(tx, ctx.staffUser.id).registerPayment(input),
          describe: async (result, database) => ({
            subject: await payerSubject(database, result.paymentEntry.payerId),
            description: `Valor recebido: ${activityMoney(result.paymentEntry.amountCents)}.`,
            deduplicationKey: `finance.registerPayment:${result.paymentEntry.id}`,
          }),
        });
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
      activityTransaction(ctx, {
        action: "finance.batchReconcile",
        work: (tx) => finance(tx, ctx.staffUser.id).batchReconcile(input),
        describe: (result) =>
          result.paymentEntries.length === 0
            ? null
            : {
                subject: { type: "receivable", name: "Conciliação de pagamentos" },
                description: `${result.paymentEntries.length} recebimentos registrados.`,
                deduplicationKey: `finance.batchReconcile:${result.paymentEntries
                  .map((row) => row.id)
                  .toSorted()
                  .join(",")}`,
              },
      }),
    ),
  waiveInstallment: adminProcedure
    .input(financeWaiveInstallmentInputSchema)
    .mutation(({ ctx, input }) =>
      activityTransaction(ctx, {
        action: "finance.waiveInstallment",
        work: (tx) => finance(tx, ctx.staffUser.id).waiveInstallment(input),
        describe: async (_result, database) => ({
          subject: await installmentSubject(database, input.installmentId),
          description: input.reason,
        }),
      }),
    ),
  addInstallmentAdjustment: adminProcedure
    .input(financeAddInstallmentAdjustmentInputSchema)
    .mutation(({ ctx, input }) =>
      activityTransaction(ctx, {
        action: "finance.addInstallmentAdjustment",
        work: (tx) => finance(tx, ctx.staffUser.id).addInstallmentAdjustment(input),
        describe: async (_result, database) => ({
          subject: await installmentSubject(database, input.installmentId),
          description: `Ajuste: ${activityMoney(input.amountCents)}. ${input.reason ?? ""}`,
        }),
      }),
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
