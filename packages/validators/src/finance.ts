import { z } from "zod";

import { dateOnlyInputSchema } from "./student.js";

const REQUIRED_TEXT_MESSAGE = "Campo obrigatorio.";
const INVALID_ORDER_ID_MESSAGE = "Identificador de pedido invalido.";
const INVALID_PAYER_ID_MESSAGE = "Identificador de pagador invalido.";

const requiredText = z.string().trim().min(1, REQUIRED_TEXT_MESSAGE);
const optionalText = z.string().trim().min(1, REQUIRED_TEXT_MESSAGE).nullish();

export const orderKindSchema = z.enum(["TUITION", "ENROLLMENT_FEE", "MATERIAL", "OTHER"]);

export const dueDaySchema = z.union([
  z.literal(5),
  z.literal(10),
  z.literal(15),
  z.literal(20),
  z.literal(25),
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

export const payerCreateProcedureInputSchema = payerCreateInputSchema;
