import type { Payer } from "@lazuli/db";
import type { payerCreateProcedureInputSchema, z } from "@lazuli/validators";

import type { FinanceDatabase } from "./order-edit-cutoff.js";

type PayerCreateInput = z.infer<typeof payerCreateProcedureInputSchema>;

export async function createPayer(input: {
  database: FinanceDatabase;
  values: PayerCreateInput;
  createdById: string;
}): Promise<Payer> {
  return input.database.payer.create({
    data: {
      name: input.values.name,
      taxId: input.values.taxId ?? null,
      phone: input.values.phone ?? null,
      email: input.values.email ?? null,
      createdById: input.createdById,
      updatedById: input.createdById,
    },
  });
}
