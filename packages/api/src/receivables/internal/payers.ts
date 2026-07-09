import type { Payer } from "@lazuli/db";
import type { payerCreateProcedureInputSchema, z } from "@lazuli/validators";

import type { ReceivablesDatabase } from "./shared.js";

export type CreatePayerInput = z.infer<typeof payerCreateProcedureInputSchema>;

export async function createPayer(input: {
  database: ReceivablesDatabase;
  values: CreatePayerInput;
  staffUserId: string;
}): Promise<Payer> {
  return input.database.payer.create({
    data: {
      name: input.values.name,
      taxId: input.values.taxId ?? null,
      phone: input.values.phone ?? null,
      email: input.values.email ?? null,
      createdById: input.staffUserId,
      updatedById: input.staffUserId,
    },
  });
}
