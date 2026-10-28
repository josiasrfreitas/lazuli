import { TRPCError } from "@trpc/server";
import { getStorage } from "@lazuli/storage";
import { paymentProofUploadSchema, z, type PaymentProofUpload } from "@lazuli/validators";
import type { Context } from "../trpc/context.js";
import { paymentProofStaff, savePaymentProof } from "./payment-proofs.js";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const INTERNAL_ERROR_STATUS = 500;
const SIGNATURES = {
  "application/pdf": Buffer.from("%PDF-"),
  "image/jpeg": Buffer.from("ffd8ff", "hex"),
  "image/png": Buffer.from("89504e470d0a1a0a", "hex"),
};

function requireSameOrigin(request: Request): void {
  const url = new URL(request.url);
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.slice(0, -1);
  if (request.headers.get("origin") !== `${protocol}://${request.headers.get("host") || url.host}`)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Abra o sistema novamente para anexar o comprovante.",
    });
}

function uploadInput(request: Request): PaymentProofUpload {
  requireSameOrigin(request);
  let metadata: Record<string, string | number>;
  try {
    metadata = JSON.parse(
      decodeURIComponent(request.headers.get("x-upload-metadata") ?? ""),
    ) as Record<string, string | number>;
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Dados do comprovante inválidos." });
  }
  const parsed = paymentProofUploadSchema.safeParse(metadata);
  if (!parsed.success || request.headers.get("content-type") !== parsed.data.contentType)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Escolha um PDF, JPG ou PNG de até 5 MB.",
    });
  return parsed.data;
}

async function proofBytes(request: Request, input: PaymentProofUpload): Promise<Buffer> {
  const reader = request.body?.getReader() as ReadableStreamDefaultReader<Uint8Array> | undefined;
  if (!reader) throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo vazio." });
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.byteLength;
    if (length > input.byteLength) {
      await reader.cancel();
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "O arquivo excede o tamanho informado.",
      });
    }
    chunks.push(part.value);
  }
  if (length !== input.byteLength)
    throw new TRPCError({ code: "BAD_REQUEST", message: "Envio interrompido. Tente novamente." });
  const bytes = Buffer.concat(chunks, length);
  const signature = SIGNATURES[input.contentType];
  if (!bytes.subarray(0, signature.length).equals(signature))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "O conteúdo não corresponde a um PDF, JPG ou PNG válido.",
    });
  return bytes;
}

function failure(error: Error | null): Response {
  const known = error instanceof TRPCError ? error : null;
  const statuses: Record<string, number> = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    BAD_REQUEST: 400,
  };
  return Response.json(
    { message: known?.message ?? "Não foi possível acessar o comprovante. Tente novamente." },
    {
      status: known ? (statuses[known.code] ?? INTERNAL_ERROR_STATUS) : INTERNAL_ERROR_STATUS,
      headers: PRIVATE_HEADERS,
    },
  );
}

export async function receivePaymentProof(ctx: Context, request: Request): Promise<Response> {
  try {
    paymentProofStaff(ctx);
    const input = uploadInput(request);
    const bytes = await proofBytes(request, input);
    return Response.json(await savePaymentProof(ctx, { input, bytes }), {
      headers: PRIVATE_HEADERS,
    });
  } catch (error) {
    return failure(error instanceof Error ? error : null);
  }
}

export async function downloadPaymentProof(ctx: Context, id: string): Promise<Response> {
  try {
    paymentProofStaff(ctx);
    if (!z.string().uuid().safeParse(id).success)
      throw new TRPCError({ code: "NOT_FOUND", message: "Comprovante não encontrado." });
    const row = await ctx.db.paymentProof.findFirst({
      where: { id, paymentEntry: { deletedAt: null } },
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
    return failure(error instanceof Error ? error : null);
  }
}
