import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";
import { paymentMethodSchema } from "./finance.js";

const MAX_ITEMS = 100;
const MAX_CENTS = 2_147_483_647;
export const MAX_THIRD_PARTY_NAME_LENGTH = 120;
const money = z.number().int().positive().max(MAX_CENTS);
const allocation = z.object({ installmentId: z.string().uuid(), amountCents: money }).strict();
export const paymentPreviewSchema = z
  .object({
    date: civilDateSchema,
    items: z
      .array(allocation.extend({ amountCents: money.optional() }))
      .min(1)
      .max(MAX_ITEMS),
  })
  .strict();
export const paymentOperationSchema = z
  .object({
    operationId: z.string().uuid(),
    date: civilDateSchema,
    method: paymentMethodSchema,
    receipts: z
      .array(
        z
          .object({
            commandId: z.string().uuid(),
            payerId: z.string().uuid(),
            thirdPartyName: z.string().trim().min(1).max(MAX_THIRD_PARTY_NAME_LENGTH).optional(),
            amountCents: money,
            externalInstallments: z.number().int().min(1).max(MAX_CENTS).optional(),
            allocations: z
              .array(allocation.extend({ version: z.string().min(1) }))
              .min(1)
              .max(MAX_ITEMS),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_ITEMS),
  })
  .strict()
  .superRefine((operation, context) => {
    if (operation.method === "PIX") return;
    for (const [index, receipt] of operation.receipts.entries()) {
      if (receipt.thirdPartyName)
        context.addIssue({
          code: "custom",
          path: ["receipts", index, "thirdPartyName"],
          message: "Informe o nome do terceiro apenas para pagamentos via Pix.",
        });
    }
  });
export type PaymentPreviewInput = z.infer<typeof paymentPreviewSchema>;
export type PaymentOperationInput = z.infer<typeof paymentOperationSchema>;
