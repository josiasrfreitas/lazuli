import { z } from "zod";

import { dateOnlyInputSchema } from "./student.js";
import {
  financeInstallmentsPaginationPolicy,
  financeOverduePaginationPolicy,
  paginationResultFields,
} from "./pagination.js";

const REQUIRED_TEXT_MESSAGE = "Campo obrigatorio.";
const INVALID_ORDER_ID_MESSAGE = "Identificador de pedido invalido.";
const INVALID_PAYER_ID_MESSAGE = "Identificador de pagador invalido.";
const INVALID_INSTALLMENT_ID_MESSAGE = "Identificador de parcela invalido.";

const FINANCE_DUE_DAY_FIFTH = 5;
const FINANCE_DUE_DAY_TENTH = 10;
const FINANCE_DUE_DAY_FIFTEENTH = 15;
const FINANCE_DUE_DAY_TWENTIETH = 20;
const FINANCE_DUE_DAY_TWENTY_FIFTH = 25;

const requiredText = z.string().trim().min(1, REQUIRED_TEXT_MESSAGE);
const optionalText = z.string().trim().min(1, REQUIRED_TEXT_MESSAGE).nullish();

export const orderKindSchema = z.enum(["TUITION", "ENROLLMENT_FEE", "MATERIAL", "OTHER"]);
export const paymentMethodSchema = z.enum([
  "PIX",
  "CASH",
  "TRANSFER",
  "CARD",
  "CHEQUE",
  "BOLETO",
  "OTHER",
]);

export const financeInstallmentViewSchema = z.enum(["all", "paid", "overdue"]);
export const financeInstallmentStatusSchema = z.enum([
  "WAIVED",
  "PAID",
  "OVERDUE",
  "DUE_THIS_MONTH",
  "UPCOMING",
]);

export const FINANCE_INSTALLMENTS_PAGE_SIZE = financeInstallmentsPaginationPolicy.defaultPageSize;
export const FINANCE_INSTALLMENTS_PAGE_SIZE_OPTIONS =
  financeInstallmentsPaginationPolicy.pageSizeOptions;
export const FINANCE_OVERDUE_PAYERS_PAGE_SIZE = financeOverduePaginationPolicy.defaultPageSize;
const FINANCE_INSTALLMENTS_SEARCH_MAX_LENGTH = 80;

export const financeInstallmentsInputSchema = z
  .object({
    view: financeInstallmentViewSchema.default("all"),
    page: financeInstallmentsPaginationPolicy.pageSchema,
    pageSize: financeInstallmentsPaginationPolicy.pageSizeSchema,
    search: z.string().trim().max(FINANCE_INSTALLMENTS_SEARCH_MAX_LENGTH).optional(),
  })
  .strict();

export const financeInstallmentRowSchema = z
  .object({
    installmentId: z.string().uuid(),
    orderId: z.string().uuid(),
    sequenceNumber: z.number().int().positive(),
    scheduleTotal: z.number().int().nonnegative(),
    payer: z.object({ id: z.string().uuid(), name: z.string() }).strict(),
    beneficiaries: z.array(
      z.object({ studentId: z.string().uuid(), fullName: z.string() }).strict(),
    ),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    originalAmountCents: z.number().int(),
    expectedAmountCents: z.number().int(),
    paidAmountCents: z.number().int(),
    collectibleBalanceCents: z.number().int().nonnegative(),
    status: financeInstallmentStatusSchema,
    overdueDays: z.number().int().nonnegative(),
  })
  .strict();

export const financeInstallmentCountsSchema = z
  .object({
    all: z.number().int().nonnegative(),
    paid: z.number().int().nonnegative(),
    overdue: z.number().int().nonnegative(),
  })
  .strict();

const financeOverdueInstallmentRowSchema = financeInstallmentRowSchema.extend({
  collectibleBalanceCents: z.number().int().positive(),
  status: z.literal("OVERDUE"),
  overdueDays: z.number().int().positive(),
});

export const financeOverduePayerGroupSchema = z
  .object({
    payer: financeInstallmentRowSchema.shape.payer,
    installmentCount: z.number().int().positive(),
    collectibleBalanceCents: z.number().int().positive(),
    maxOverdueDays: z.number().int().positive(),
    beneficiaries: financeInstallmentRowSchema.shape.beneficiaries,
    rows: z.array(financeOverdueInstallmentRowSchema),
  })
  .strict();
export type FinanceOverduePayerGroup = z.infer<typeof financeOverduePayerGroupSchema>;

const financeInstallmentsOutputFields = {
  ...paginationResultFields(financeInstallmentsPaginationPolicy),
  counts: financeInstallmentCountsSchema,
};

// Stryker disable StringLiteral,ObjectLiteral: changing Zod discriminators aborts schema construction.
export const financeInstallmentsOutputSchema = z.discriminatedUnion("view", [
  z
    .object({
      view: z.literal("all"),
      ...financeInstallmentsOutputFields,
      rows: z.array(financeInstallmentRowSchema),
    })
    .strict(),
  z
    .object({
      view: z.literal("paid"),
      ...financeInstallmentsOutputFields,
      rows: z.array(financeInstallmentRowSchema),
    })
    .strict(),
  z
    .object({
      ...financeInstallmentsOutputFields,
      view: z.literal("overdue"),
      groups: z.array(financeOverduePayerGroupSchema),
      pageSize: z.literal(FINANCE_OVERDUE_PAYERS_PAGE_SIZE),
    })
    .strict(),
]);
// Stryker restore StringLiteral,ObjectLiteral

export type FinanceInstallmentsInput = z.infer<typeof financeInstallmentsInputSchema>;
export type FinanceInstallmentsOutput = z.infer<typeof financeInstallmentsOutputSchema>;
export type FinanceInstallmentRow = z.infer<typeof financeInstallmentRowSchema>;

export const dueDaySchema = z.union([
  z.literal(FINANCE_DUE_DAY_FIFTH),
  z.literal(FINANCE_DUE_DAY_TENTH),
  z.literal(FINANCE_DUE_DAY_FIFTEENTH),
  z.literal(FINANCE_DUE_DAY_TWENTIETH),
  z.literal(FINANCE_DUE_DAY_TWENTY_FIFTH),
]);

export const payerCreateInputSchema = z
  .object({
    name: requiredText,
    taxId: optionalText,
    phone: optionalText,
    email: optionalText,
  })
  .strict();

// Stryker disable StringLiteral,ObjectLiteral: changing Zod discriminators aborts schema construction.
const existingPayerInputSchema = z
  .object({
    mode: z.literal("existing"),
    payerId: z.string().uuid(INVALID_PAYER_ID_MESSAGE),
  })
  .strict();

const createPayerInputSchema = z
  .object({
    mode: z.literal("create"),
    ...payerCreateInputSchema.shape,
  })
  .strict();

export const financePayerInputSchema = z.discriminatedUnion("mode", [
  existingPayerInputSchema,
  createPayerInputSchema,
]);
// Stryker restore StringLiteral,ObjectLiteral

const orderCommercialFieldsSchema = z.object({
  kind: orderKindSchema,
  beneficiaryStudentIds: z
    .array(z.string().uuid("Identificador de aluno invalido."))
    .min(1, "Informe ao menos um beneficiario."),
  principalAmountCents: z
    .number()
    .int("Valor principal deve ser inteiro.")
    .positive("Valor principal deve ser maior que zero."),
  installmentCount: z
    .number()
    .int("Quantidade de parcelas deve ser inteira.")
    .min(1, "Informe ao menos uma parcela."),
  startDate: dateOnlyInputSchema,
  dueDay: dueDaySchema,
  signedOrderArtifactId: z.string().uuid("Identificador de artefato invalido.").optional(),
});

/**
 * Input for `finance.createOrder` (S-FIN-1). Payer existence and beneficiary student
 * validation are enforced in the service layer.
 */
export const financeCreateOrderInputSchema = orderCommercialFieldsSchema
  .extend({
    payer: financePayerInputSchema,
  })
  .strict();

/**
 * Input for `finance.updateOrder` (S-FIN-1 edit cutoff). Payer changes are out of scope
 * for MVP; commercial fields may be edited only while the order has no financial activity.
 */
export const financeUpdateOrderInputSchema = orderCommercialFieldsSchema
  .extend({
    orderId: z.string().uuid(INVALID_ORDER_ID_MESSAGE),
  })
  .strict();

export const financeRegisterPaymentInputSchema = z
  .object({
    payerId: z.string().uuid(INVALID_PAYER_ID_MESSAGE),
    date: dateOnlyInputSchema,
    amountCents: z
      .number()
      .int("Valor do pagamento deve ser inteiro.")
      .nonnegative("Valor do pagamento nao pode ser negativo."),
    method: paymentMethodSchema,
    note: optionalText,
    externalReference: optionalText,
    allocations: z
      .array(
        z
          .object({
            installmentId: z.string().uuid(INVALID_INSTALLMENT_ID_MESSAGE),
            amountCents: z
              .number()
              .int("Valor da alocacao deve ser inteiro.")
              .nonnegative("Valor da alocacao nao pode ser negativo."),
          })
          .strict(),
      )
      .min(1, "Informe ao menos uma alocacao."),
  })
  .strict();

export const financeBatchReconcileInputSchema = z
  .object({
    date: dateOnlyInputSchema,
    method: paymentMethodSchema,
    externalReference: optionalText,
    installmentIds: z
      .array(z.string().uuid(INVALID_INSTALLMENT_ID_MESSAGE))
      .min(1, "Informe ao menos uma parcela."),
  })
  .strict();

export const payerCreateProcedureInputSchema = payerCreateInputSchema;

export const installmentAdjustmentTypeSchema = z.enum([
  "INTEREST",
  "LATE_FEE",
  "DISCOUNT",
  "CORRECTION",
]);

/**
 * Input for `finance.waiveInstallment` (S-FIN-5).
 */
export const financeWaiveInstallmentInputSchema = z
  .object({
    installmentId: z.string().uuid(INVALID_INSTALLMENT_ID_MESSAGE),
    reason: requiredText,
  })
  .strict();

/**
 * Input for `finance.addInstallmentAdjustment` (S-FIN-8 and charged interest/multa).
 */
export const financeAddInstallmentAdjustmentInputSchema = z
  .object({
    installmentId: z.string().uuid(INVALID_INSTALLMENT_ID_MESSAGE),
    type: installmentAdjustmentTypeSchema,
    amountCents: z.number().int("Valor do ajuste deve ser inteiro."),
    reason: optionalText,
  })
  .strict();
