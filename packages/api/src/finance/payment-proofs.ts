import { createHash, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { getStorage } from "@lazuli/storage";
import type { TransactionClient } from "@lazuli/db";
import type { PaymentProofUpload } from "@lazuli/validators";
import type { Context, StaffUser } from "../trpc/context.js";
import { recordActivity } from "../activity/record.js";
import { payerSubject } from "../activity/subjects.js";
import { toDateOnlyString } from "./internal/shared.js";
import { studentPaymentWhere } from "./internal/student-payments-query.js";

const PAYMENT_PAGE_SIZE = 20;

export function paymentProofStaff(ctx: Context): StaffUser {
  if (!ctx.staffUser)
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Entre no sistema novamente." });
  if (!["ADMIN", "SYSTEM_ADMIN"].includes(ctx.staffUser.role))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Sem acesso aos comprovantes de pagamento.",
    });
  return ctx.staffUser;
}

export async function savePaymentProof(
  ctx: Context,
  { input, bytes }: { input: PaymentProofUpload; bytes: Buffer },
): Promise<{ id: string }> {
  const staffUser = paymentProofStaff(ctx);
  const payment = await ctx.db.paymentEntry.findFirst({
    where: { id: input.paymentEntryId, deletedAt: null },
    select: { id: true, payerId: true },
  });
  if (!payment) throw new TRPCError({ code: "NOT_FOUND", message: "Pagamento não encontrado." });
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const existing = await ctx.db.paymentProof.findUnique({ where: { id: input.id } });
  if (existing) {
    assertSameProof(existing, { input, sha256 });
    return { id: existing.id };
  }
  const storage = getStorage();
  const reference = await storage.put({
    key: `payment-proofs/${randomUUID()}`,
    bytes,
    contentType: input.contentType,
  });
  try {
    const saved = await ctx.db.$transaction(async (database) => {
      await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.id}, 0))`;
      const previous = await database.paymentProof.findUnique({ where: { id: input.id } });
      if (previous) {
        assertSameProof(previous, { input, sha256 });
        return false;
      }
      await database.paymentProof.create({
        data: { ...input, ...reference, sha256, uploadedById: staffUser.id },
      });
      await recordProofActivity(database, { ctx, staffUser, payerId: payment.payerId, input });
      return true;
    });
    if (!saved) await storage.remove(reference);
    return { id: input.id };
  } catch (error) {
    await storage.remove(reference).catch((): void => {});
    throw error;
  }
}

async function recordProofActivity(
  database: TransactionClient,
  {
    ctx,
    staffUser,
    payerId,
    input,
  }: { ctx: Context; staffUser: StaffUser; payerId: string; input: PaymentProofUpload },
): Promise<void> {
  await recordActivity(database, {
    context: { staffUser, now: ctx.now },
    action: "finance.attachPaymentProof",
    details: {
      subject: await payerSubject(database, payerId),
      description: `Comprovante: ${input.fileName}.`,
      deduplicationKey: `finance.attachPaymentProof:${input.id}`,
    },
  });
}

function assertSameProof(
  stored: { paymentEntryId: string; sha256: string; fileName: string; contentType: string },
  { input, sha256 }: { input: PaymentProofUpload; sha256: string },
): void {
  if (
    stored.paymentEntryId !== input.paymentEntryId ||
    stored.sha256 !== sha256 ||
    stored.fileName !== input.fileName ||
    stored.contentType !== input.contentType
  )
    throw new TRPCError({
      code: "CONFLICT",
      message: "Este envio já foi usado para outro comprovante.",
    });
}

export async function studentPayments(
  ctx: Context,
  input: { studentId: string; cursor?: string | undefined; withProofs?: boolean | undefined },
): Promise<{
  rows: Array<{
    id: string;
    date: string;
    amountCents: number;
    externalInstallments: number;
    payer: { name: string };
    paymentMethod: { name: string };
    thirdPartyName: string | null;
    proofs: Array<{ id: string; fileName: string; byteLength: number }>;
  }>;
  nextCursor: string | undefined;
}> {
  paymentProofStaff(ctx);
  const rows = await ctx.db.paymentEntry.findMany({
    where: {
      ...studentPaymentWhere(input.studentId),
      ...(input.withProofs ? { proofs: { some: { deletedAt: null } } } : {}),
    },
    select: {
      id: true,
      date: true,
      amountCents: true,
      externalInstallments: true,
      payer: { select: { name: true } },
      paymentMethod: { select: { name: true } },
      thirdPartyName: true,
      proofs: {
        where: { deletedAt: null },
        select: { id: true, fileName: true, byteLength: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: PAYMENT_PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });
  const more = rows.length > PAYMENT_PAGE_SIZE;
  if (more) rows.pop();
  return {
    rows: rows.map((row) => ({ ...row, date: toDateOnlyString(row.date) })),
    nextCursor: more ? rows.at(-1)?.id : undefined,
  };
}
