import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";
import { paymentMethodSchema } from "./finance.js";

const MAX_ITEMS = 100;
const MAX_CENTS = 2_147_483_647;
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
            amountCents: money,
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
  .strict();
export type PaymentPreviewInput = z.infer<typeof paymentPreviewSchema>;
export type PaymentOperationInput = z.infer<typeof paymentOperationSchema>;
