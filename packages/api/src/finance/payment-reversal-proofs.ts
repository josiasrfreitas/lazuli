import { createHash, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { getStorage } from "@lazuli/storage";
import type { PaymentReversalProofUpload } from "@lazuli/validators";
import type { Context } from "../trpc/context.js";
import { recordActivity } from "../activity/record.js";
import { payerSubject } from "../activity/subjects.js";
import { paymentProofStaff } from "./payment-proofs.js";

export async function savePaymentReversalProof(
  ctx: Context,
  { input, bytes }: { input: PaymentReversalProofUpload; bytes: Buffer },
): Promise<{ id: string }> {
  const staffUser = paymentProofStaff(ctx);
  const reversal = await ctx.db.paymentReversal.findFirst({
    where: { id: input.paymentReversalId, deletedAt: null, kind: "REFUND" },
    select: { id: true, paymentEntry: { select: { payerId: true } } },
  });
  if (!reversal) throw new TRPCError({ code: "NOT_FOUND", message: "Estorno não encontrado." });
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const existing = await ctx.db.paymentReversalProof.findUnique({ where: { id: input.id } });
  if (existing) {
    assertSameProof(existing, { input, sha256 });
    return { id: existing.id };
  }
  const storage = getStorage();
  const reference = await storage.put({
    key: `payment-reversal-proofs/${randomUUID()}`,
    bytes,
    contentType: input.contentType,
  });
  try {
    const saved = await ctx.db.$transaction(async (database) => {
      await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.id}, 0))`;
      const previous = await database.paymentReversalProof.findUnique({ where: { id: input.id } });
      if (previous) {
        assertSameProof(previous, { input, sha256 });
        return false;
      }
      await database.paymentReversalProof.create({
        data: { ...input, ...reference, sha256, uploadedById: staffUser.id },
      });
      await recordActivity(database, {
        context: { staffUser, now: ctx.now },
        action: "finance.attachRefundProof",
        details: {
          subject: await payerSubject(database, reversal.paymentEntry.payerId),
          description: `Comprovante: ${input.fileName}.`,
          deduplicationKey: `finance.attachRefundProof:${input.id}`,
        },
      });
      return true;
    });
    if (!saved) await storage.remove(reference);
    return { id: input.id };
  } catch (error) {
    await storage.remove(reference).catch((): void => {});
    throw error;
  }
}

function assertSameProof(
  stored: { paymentReversalId: string; sha256: string; fileName: string; contentType: string },
  { input, sha256 }: { input: PaymentReversalProofUpload; sha256: string },
): void {
  if (
    stored.paymentReversalId !== input.paymentReversalId ||
    stored.sha256 !== sha256 ||
    stored.fileName !== input.fileName ||
    stored.contentType !== input.contentType
  )
    throw new TRPCError({
      code: "CONFLICT",
      message: "Este envio já foi usado para outro comprovante.",
    });
}
