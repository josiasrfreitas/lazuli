import {
  financeCreateOrderInputSchema,
  financeUpdateOrderInputSchema,
  payerCreateProcedureInputSchema,
} from "@lazuli/validators";

import { adminProcedure, router } from "../trpc/init.js";
import { createOrder } from "./create-order.js";
import { createPayer } from "./create-payer.js";
import { updateOrder } from "./update-order.js";

export const financeRouter = router({
  createPayer: adminProcedure.input(payerCreateProcedureInputSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      createPayer({
        database,
        values: input,
        createdById: ctx.staffUser.id,
      }),
    ),
  ),
  createOrder: adminProcedure.input(financeCreateOrderInputSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      createOrder({
        database,
        values: input,
        createdById: ctx.staffUser.id,
      }),
    ),
  ),
  updateOrder: adminProcedure.input(financeUpdateOrderInputSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      updateOrder({
        database,
        values: input,
        updatedById: ctx.staffUser.id,
      }),
    ),
  ),
});
