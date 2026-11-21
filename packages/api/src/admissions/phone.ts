import type { Prisma } from "@lazuli/db";
import { TRPCError } from "@trpc/server";

export async function checkLeadPhone(
  database: Prisma.TransactionClient,
  { id, phone }: { id: string; phone: string | null },
): Promise<void> {
  if (!phone) return;
  // Serialize equivalent writes before checking, so concurrent callers receive the same message.
  await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(lead_phone_key(${phone}), 169))`;
  const matches = await database.$queryRaw<{ id: string }[]>`SELECT id FROM "AdmissionCandidate"
    WHERE deleted_at IS NULL AND lead_phone_key(phone) = lead_phone_key(${phone}) AND id <> ${id}::uuid LIMIT 1`;
  if (matches.length > 0)
    throw new TRPCError({ code: "CONFLICT", message: "Já existe um lead com este telefone." });
}
