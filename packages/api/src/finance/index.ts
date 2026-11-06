import { treatmentInstallments } from "./internal/treatment-data.js";
import { previewTreatment } from "./internal/treatment-preview.js";
import { confirmTreatment, treatmentHistory } from "./internal/treatment-confirm.js";
import type {
  FinancialTreatmentInstallments,
  FinancialTreatmentPreview,
  FinancialTreatmentConfirm,
} from "@lazuli/validators";
import { saoPauloDateOnly } from "@lazuli/domain";
import { readContract } from "./internal/contract-detail.js";
import { addContractMaterial, contractMaterialOptions } from "./internal/contract-materials.js";
import { readStudentMaterials } from "./internal/student-materials.js";
import type { AddContractMaterialInput } from "@lazuli/validators";
import {
  previewContractTermination,
  confirmContractTermination,
} from "./internal/contract-termination.js";
import type { ContractTerminationConfirm } from "@lazuli/validators";
import { readAnalytics } from "./internal/analytics.js";
import { readStudentSummary } from "./internal/student-summary.js";
import { readContractInstallments } from "./internal/contract-installments.js";
import {
  contractRenegotiationOptions,
  previewContractRenegotiation,
  confirmContractRenegotiation,
} from "./internal/contract-renegotiation.js";
import { readContractClosings } from "./internal/contract-closings.js";
import { previewPayments } from "./internal/payment-preview.js";
import { confirmPayments } from "./internal/payment-operation.js";
import type { PaymentPreviewInput, PaymentOperationInput } from "@lazuli/validators";
import type {
  ContractRenegotiationPreview,
  ContractRenegotiationConfirm,
} from "@lazuli/validators";
import { searchContractParties } from "./internal/contract-parties.js";
import { batchReconcile, type BatchReconcileResult } from "./internal/batch-reconcile.js";
import {
  createMonthlyContract,
  findCommandResult,
  listContracts,
  readContractOffer,
} from "./internal/contracts.js";
import {
  addInstallmentAdjustment,
  waiveInstallment,
  type AddInstallmentAdjustmentResult,
  type WaiveInstallmentResult,
} from "./treatments/index.js";
import { listInstallments } from "./internal/installments.js";
import {
  overdueList,
  receivablesSnapshot,
  type OverdueListResult,
} from "./internal/ledger-read.js";
import { createOrder, updateOrder, type OrderScheduleResult } from "./internal/orders.js";
import { createPayer } from "./internal/payers.js";
import {
  findPaymentCommand,
  registerPayment,
  type RegisterPaymentResult,
} from "./internal/register-payment.js";
import { paymentReversalOptions, reversePayment } from "./internal/payment-reversals.js";
import { readSettings, saveSettings, readMaterialPrice } from "./internal/settings.js";
import type { FinanceDatabase } from "./internal/shared.js";
import { studentOverdueTotals, type StudentOverdueTotal } from "./internal/student-balances.js";
import type { Payer } from "@lazuli/db";
import type { ReceivablesSnapshot } from "@lazuli/domain";
import type {
  financeAddInstallmentAdjustmentInputSchema,
  financeBatchReconcileInputSchema,
  financeCreateOrderInputSchema,
  financeRegisterPaymentInputSchema,
  financeReversePaymentInputSchema,
  financeUpdateOrderInputSchema,
  financeWaiveInstallmentInputSchema,
  financeInstallmentsInputSchema,
  FinanceInstallmentsOutput,
  FinanceSettingsInput,
  CreateMonthlyContractInput,
  payerCreateProcedureInputSchema,
  z,
} from "@lazuli/validators";

/**
 * The finance module: the single deep interface over the payer → order →
 * installment → payment → dashboard chain. tRPC procedures in ./router.ts are
 * its only callers; installment generation, ledger derivation, and dashboard
 * aggregation are implementation details behind ./internal. See D-0037.
 *
 * `db` may be a full PrismaClient (read paths) or a transaction client (mutations);
 * the router opens the transaction so the whole operation commits atomically.
 * `staffUserId` is the acting administrator, stamped onto created/updated rows.
 */
export function finance(db: FinanceDatabase, staffUserId: string): FinanceModule {
  return {
    treatmentInstallments: (values, now) => treatmentInstallments(db, { values, now }),
    previewTreatment: (values, now) => previewTreatment(db, { values, now }),
    confirmTreatment: (values, { actorName, now }) =>
      confirmTreatment({ database: db, values, actor: { id: staffUserId, name: actorName }, now }),
    treatmentHistory: (studentId) => treatmentHistory(db, studentId),
    previewTermination: (id, now) => previewContractTermination(db, { contractId: id, now }),
    confirmTermination: (values, now) =>
      confirmContractTermination({ database: db, values, now, staffUserId }),
    analytics: (values) => readAnalytics(db, values),
    studentSummary: (values) => readStudentSummary(db, values),
    contractInstallments: (values) => readContractInstallments(db, values),
    studentMaterials: (values) => readStudentMaterials(db, values),
    ...renegotiationFinance(db, staffUserId),
    contractClosings: async (year, now) => {
      const asOf = saoPauloDateOnly(now);
      return { ...(await readContractClosings(db, { year, asOf })), year, asOf };
    },
    previewPayments: (values, now) => previewPayments({ database: db, values, now }),
    confirmPayments: (values, now) => confirmPayments({ database: db, values, staffUserId, now }),
    readContract: (id, now) => readContract(db, { id, now }),
    addContractMaterial: (values) => addContractMaterial({ database: db, staffUserId, values }),
    contractMaterialOptions: () => contractMaterialOptions(db),
    readSettings: () => readSettings(db),
    readMaterialPrice: () => readMaterialPrice(db),
    saveSettings: (values) => saveSettings({ database: db, staffUserId, values }),
    createPayer: (values) => createPayer({ database: db, values, staffUserId }),
    createMonthlyContract: (values) => createMonthlyContract({ database: db, values, staffUserId }),
    findCommandResult: (values) => findCommandResult(db, values),
    listContracts: (options) => listContracts(db, options),
    searchContractParties: (query) => searchContractParties(db, query),
    readContractOffer: () => readContractOffer(db),
    createOrder: (values) => createOrder({ database: db, values, staffUserId }),
    updateOrder: (values) => updateOrder({ database: db, values, staffUserId }),
    registerPayment: (values) => registerPayment({ database: db, values, staffUserId }),
    paymentReversalOptions: (paymentEntryId) => paymentReversalOptions(db, paymentEntryId),
    reversePayment: (values, now) => reversePayment({ database: db, values, staffUserId, now }),
    findPaymentCommand: (values) => findPaymentCommand(db, values),
    batchReconcile: (values) => batchReconcile({ database: db, values, staffUserId }),
    waiveInstallment: (values) => waiveInstallment({ database: db, values, staffUserId }),
    addInstallmentAdjustment: (values) =>
      addInstallmentAdjustment({ database: db, values, staffUserId }),
    receivablesSnapshot: () => receivablesSnapshot(db),
    overdueList: () => overdueList(db),
    installments: (values, now = new Date()) => listInstallments({ database: db, values, now }),
    studentOverdueTotals: (values) => studentOverdueTotals({ database: db, values }),
  };
}

function renegotiationFinance(
  db: FinanceDatabase,
  staffUserId: string,
): Pick<FinanceModule, "renegotiationOptions" | "previewRenegotiation" | "confirmRenegotiation"> {
  return {
    renegotiationOptions: (contractId, now) =>
      contractRenegotiationOptions(db, { contractId, now }),
    previewRenegotiation: (values, now) => previewContractRenegotiation(db, { values, now }),
    confirmRenegotiation: (values, { actorName, now }) =>
      confirmContractRenegotiation({
        database: db,
        values,
        actor: { id: staffUserId, name: actorName },
        now,
      }),
  };
}

export type FinanceModule = {
  treatmentInstallments: (
    values: FinancialTreatmentInstallments,
    now: Date,
  ) => ReturnType<typeof treatmentInstallments>;
  previewTreatment: (
    values: FinancialTreatmentPreview,
    now: Date,
  ) => ReturnType<typeof previewTreatment>;
  confirmTreatment: (
    values: FinancialTreatmentConfirm,
    context: { actorName: string; now: Date },
  ) => ReturnType<typeof confirmTreatment>;
  treatmentHistory: (studentId: string) => ReturnType<typeof treatmentHistory>;
  readContract: (id: string, now: Date) => ReturnType<typeof readContract>;
  addContractMaterial: (values: AddContractMaterialInput) => ReturnType<typeof addContractMaterial>;
  contractMaterialOptions: () => ReturnType<typeof contractMaterialOptions>;
  studentMaterials: (values: {
    studentId: string;
    now: Date;
  }) => ReturnType<typeof readStudentMaterials>;
  previewTermination: (id: string, now: Date) => ReturnType<typeof previewContractTermination>;
  confirmTermination: (
    values: ContractTerminationConfirm,
    now: Date,
  ) => ReturnType<typeof confirmContractTermination>;
  studentSummary: (values: {
    studentId: string;
    now: Date;
  }) => ReturnType<typeof readStudentSummary>;
  contractInstallments: (values: {
    orderId: string;
    now: Date;
  }) => ReturnType<typeof readContractInstallments>;
  renegotiationOptions: (
    contractId: string,
    now: Date,
  ) => ReturnType<typeof contractRenegotiationOptions>;
  previewRenegotiation: (
    values: ContractRenegotiationPreview,
    now: Date,
  ) => ReturnType<typeof previewContractRenegotiation>;
  confirmRenegotiation: (
    values: ContractRenegotiationConfirm,
    context: { actorName: string; now: Date },
  ) => ReturnType<typeof confirmContractRenegotiation>;
  analytics: (values: { year: number; now: Date }) => ReturnType<typeof readAnalytics>;
  contractClosings: (
    year: number,
    now: Date,
  ) => Promise<Awaited<ReturnType<typeof readContractClosings>> & { year: number; asOf: string }>;
  previewPayments: (values: PaymentPreviewInput, now: Date) => ReturnType<typeof previewPayments>;
  confirmPayments: (values: PaymentOperationInput, now: Date) => ReturnType<typeof confirmPayments>;
  readSettings: () => ReturnType<typeof readSettings>;
  readMaterialPrice: () => ReturnType<typeof readMaterialPrice>;
  saveSettings: (values: FinanceSettingsInput) => ReturnType<typeof saveSettings>;
  createPayer: (values: z.infer<typeof payerCreateProcedureInputSchema>) => Promise<Payer>;
  createMonthlyContract: (
    values: CreateMonthlyContractInput,
  ) => ReturnType<typeof createMonthlyContract>;
  findCommandResult: (values: CreateMonthlyContractInput) => ReturnType<typeof findCommandResult>;
  listContracts: (options: {
    page: number;
    query?: string;
    payerId?: string | undefined;
    studentId?: string | undefined;
    startsFrom?: string | undefined;
    endsTo?: string | undefined;
    status?: "INADIMPLENTE" | "EM_DIA" | "QUITADO" | "SEM_SALDO" | "CANCELADO" | undefined;
    now?: Date;
  }) => ReturnType<typeof listContracts>;
  searchContractParties: (query: string) => ReturnType<typeof searchContractParties>;
  readContractOffer: () => ReturnType<typeof readContractOffer>;
  createOrder: (
    values: z.infer<typeof financeCreateOrderInputSchema>,
  ) => Promise<OrderScheduleResult>;
  updateOrder: (
    values: z.infer<typeof financeUpdateOrderInputSchema>,
  ) => Promise<OrderScheduleResult>;
  registerPayment: (
    values: z.infer<typeof financeRegisterPaymentInputSchema>,
  ) => Promise<RegisterPaymentResult>;
  paymentReversalOptions: (paymentEntryId: string) => ReturnType<typeof paymentReversalOptions>;
  reversePayment: (
    values: z.infer<typeof financeReversePaymentInputSchema>,
    now: Date,
  ) => ReturnType<typeof reversePayment>;
  findPaymentCommand: (
    values: z.infer<typeof financeRegisterPaymentInputSchema>,
  ) => Promise<RegisterPaymentResult | null>;
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
  installments: (
    values: z.infer<typeof financeInstallmentsInputSchema>,
    now?: Date,
  ) => Promise<FinanceInstallmentsOutput>;
  /** One derived finance fact per student, for listings (see student-balances.ts). */
  studentOverdueTotals: (values: {
    studentIds: readonly string[];
    now: Date;
  }) => Promise<StudentOverdueTotal[]>;
};

export type { BatchReconcileResult } from "./internal/batch-reconcile.js";
export type { AddInstallmentAdjustmentResult, WaiveInstallmentResult } from "./treatments/index.js";
export type { OverdueListResult } from "./internal/ledger-read.js";
export type { OrderScheduleResult } from "./internal/orders.js";
export type { RegisterPaymentResult } from "./internal/register-payment.js";
export type { StudentOverdueTotal } from "./internal/student-balances.js";

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
