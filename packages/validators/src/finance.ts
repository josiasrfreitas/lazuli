import { z } from "zod";

import { dateOnlyInputSchema } from "./student.js";

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

export const payerCreateProcedureInputSchema = payerCreateInputSchema;
