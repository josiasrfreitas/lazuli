import type { Payer } from "@lazuli/db";
import type {
  CreateMonthlyContractInput,
  payerCreateProcedureInputSchema,
  z,
} from "@lazuli/validators";

import type { FinanceDatabase } from "./shared.js";

export type CreatePayerInput = z.infer<typeof payerCreateProcedureInputSchema>;

export async function createContractPayer(input: {
  database: FinanceDatabase;
  values: NonNullable<CreateMonthlyContractInput["newPayer"]>;
  staffUserId: string;
}): Promise<Payer> {
  return input.database.payer.create({
    data: {
      name: input.values.name,
      phone: input.values.phone ?? null,
      email: input.values.email ?? null,
      documentType: input.values.documentType ?? null,
      documentNumber: input.values.documentNumber ?? null,
      createdById: input.staffUserId,
      updatedById: input.staffUserId,
    },
  });
}

export async function createPayer(input: {
  database: FinanceDatabase;
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
