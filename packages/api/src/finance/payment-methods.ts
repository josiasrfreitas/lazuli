import { randomUUID } from "node:crypto";
import type { PaymentMethod, TransactionClient } from "@lazuli/db";

type MethodCreation = {
  method: Pick<PaymentMethod, "id" | "code" | "name" | "active" | "allowsExternalInstallments">;
  outcome: "existing" | "reactivated" | "created";
};

const methodSelect = {
  id: true,
  code: true,
  name: true,
  active: true,
  allowsExternalInstallments: true,
} as const;

export async function createPaymentMethod(
  database: TransactionClient,
  name: string,
): Promise<MethodCreation> {
  const lockKey = `payment-method:${name.toLocaleLowerCase("pt-BR")}`;
  await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

  const existing = await database.paymentMethod.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, deletedAt: null },
    select: methodSelect,
  });
  if (existing) {
    if (existing.active) return { method: existing, outcome: "existing" as const };
    const method = await database.paymentMethod.update({
      where: { id: existing.id },
      data: { active: true },
      select: methodSelect,
    });
    return { method, outcome: "reactivated" as const };
  }

  const highest = await database.paymentMethod.aggregate({ _max: { sortOrder: true } });
  const method = await database.paymentMethod.create({
    data: {
      code: `CUSTOM_${randomUUID().replaceAll("-", "").toUpperCase()}`,
      name,
      sortOrder: (highest._max.sortOrder ?? 0) + 1,
    },
    select: methodSelect,
  });
  return { method, outcome: "created" as const };
}
