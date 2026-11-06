import { TRPCError } from "@trpc/server";
import { getStorage } from "@lazuli/storage";
import {
  paymentReversalProofUploadSchema,
  z,
  type PaymentReversalProofUpload,
} from "@lazuli/validators";
import type { Context } from "../trpc/context.js";
import { paymentProofStaff } from "./payment-proofs.js";
import { proofBytes, proofFailure, requireSameOrigin } from "./payment-proof-transport.js";
import { savePaymentReversalProof } from "./payment-reversal-proofs.js";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export async function receivePaymentReversalProof(
  ctx: Context,
  request: Request,
): Promise<Response> {
  try {
    paymentProofStaff(ctx);
    requireSameOrigin(request);
    let metadata: PaymentReversalProofUpload;
    try {
      metadata = JSON.parse(
        decodeURIComponent(request.headers.get("x-upload-metadata") ?? ""),
      ) as PaymentReversalProofUpload;
    } catch {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Dados do comprovante inválidos." });
    }
    const parsed = paymentReversalProofUploadSchema.safeParse(metadata);
    if (!parsed.success || request.headers.get("content-type") !== parsed.data.contentType)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Escolha um PDF, JPG ou PNG de até 5 MB.",
      });
    const input: PaymentReversalProofUpload = parsed.data;
    const bytes = await proofBytes(request, input);
    return Response.json(await savePaymentReversalProof(ctx, { input, bytes }), {
      headers: PRIVATE_HEADERS,
    });
  } catch (error) {
    return proofFailure(error instanceof Error ? error : null);
  }
}

export async function downloadPaymentReversalProof(ctx: Context, id: string): Promise<Response> {
  try {
    paymentProofStaff(ctx);
    if (!z.string().uuid().safeParse(id).success)
      throw new TRPCError({ code: "NOT_FOUND", message: "Comprovante não encontrado." });
    const row = await ctx.db.paymentReversalProof.findFirst({
      where: {
        id,
        deletedAt: null,
        reversal: { deletedAt: null, paymentEntry: { deletedAt: null } },
      },
    });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Comprovante não encontrado." });
    const file = await getStorage().read(row);
    return new Response(Buffer.from(file.bytes), {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": row.contentType,
        "Content-Length": String(file.bytes.length),
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `attachment; filename="comprovante"; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
      },
    });
  } catch (error) {
    return proofFailure(error instanceof Error ? error : null);
  }
}
