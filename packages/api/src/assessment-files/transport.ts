import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { getStorage } from "@lazuli/storage";
import { MAX_UPLOAD_FILE_MB, type z } from "@lazuli/validators";
import { enqueueAssessmentFile } from "@lazuli/integrations/hatchet";
import type { Context } from "../trpc/context.js";
import type { AssessmentContext } from "../assessments/data.js";
import { authorizedFile, fileInputSchema, MAX_ASSESSMENT_BYTES, prepareFile } from "./data.js";

const PRIVATE_CACHE = "private, no-store";
const errorStatuses = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  INTERNAL: 500,
};
type PreparedClaim = Awaited<ReturnType<typeof prepareFile>>;

function staffContext(ctx: Context): AssessmentContext {
  if (!ctx.staffUser || !["TEACHER", "ADMIN", "SYSTEM_ADMIN"].includes(ctx.staffUser.role))
    throw new TRPCError({ code: "UNAUTHORIZED" });
  return { database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() };
}
async function readBytes(request: Request, size: number): Promise<Uint8Array> {
  const reader: ReadableStreamDefaultReader<Uint8Array> | undefined = request.body?.getReader();
  if (!reader) throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo vazio." });
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    length += next.value.byteLength;
    if (length > MAX_ASSESSMENT_BYTES || length > size) {
      await reader.cancel();
      throw new TRPCError({ code: "BAD_REQUEST", message: "O arquivo excede o limite informado." });
    }
    chunks.push(next.value);
  }
  if (length !== size)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "O envio foi interrompido. Tente novamente.",
    });
  return Buffer.concat(chunks, length);
}
function failure(error: Error): Response {
  const known = error instanceof TRPCError;
  const status = known
    ? (errorStatuses[error.code as keyof typeof errorStatuses] ?? errorStatuses.BAD_REQUEST)
    : errorStatuses.INTERNAL;
  return Response.json(
    { message: known ? error.message : "Não foi possível concluir o envio. Tente novamente." },
    { status, headers: { "Cache-Control": PRIVATE_CACHE } },
  );
}
function uploadInput(request: Request): z.infer<typeof fileInputSchema> {
  const requestUrl = new URL(request.url);
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    requestUrl.protocol.slice(0, -1);
  const publicOrigin = `${protocol}://${request.headers.get("host") || requestUrl.host}`;
  if (request.headers.get("origin") !== publicOrigin)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Abra o sistema novamente para enviar o arquivo.",
    });
  const header = request.headers.get("x-upload-metadata");
  const parsed = fileInputSchema.safeParse(header ? JSON.parse(decodeURIComponent(header)) : null);
  if (!parsed.success)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Escolha uma foto JPG/PNG ou PDF de até ${MAX_UPLOAD_FILE_MB} MB.`,
    });
  return parsed.data;
}
async function persistUpload(
  ctx: Context,
  {
    claim,
    bytes,
    contentType,
  }: {
    claim: PreparedClaim;
    bytes: Uint8Array;
    contentType: string;
  },
): Promise<void> {
  const reference = await getStorage().put({
    key: `academic-assessments/${randomUUID()}`,
    bytes,
    contentType,
  });
  try {
    const changed = await ctx.db.assessmentFile.updateMany({
      where: { id: claim.row.id, status: "UPLOADING", updatedAt: claim.row.updatedAt },
      data: { ...reference, receivedAt: new Date(), status: "RECEIVED", failureCode: null },
    });
    if (!changed.count)
      throw new TRPCError({
        code: "CONFLICT",
        message: "Outro envio substituiu esta tentativa. Atualize a fila.",
      });
  } catch (error) {
    await getStorage()
      .remove(reference)
      .catch(() => {});
    throw error;
  }
}
export async function receiveAssessmentFile(ctx: Context, request: Request): Promise<Response> {
  let claim: PreparedClaim | undefined;
  try {
    const context = staffContext(ctx);
    const input = uploadInput(request);
    claim = await ctx.db.$transaction((database) => prepareFile({ ...context, database }, input));
    if (claim.received) return Response.json({ id: claim.row.id, status: claim.row.status });
    const bytes = await readBytes(request, input.byteLength);
    await persistUpload(ctx, { claim, bytes, contentType: input.contentType });
    // A durable RECEIVED row remains recoverable when dispatch is unavailable.
    await enqueueAssessmentFile({ fileId: claim.row.id }).catch(() => {});
    return Response.json(
      { id: claim.row.id, status: "RECEIVED" },
      { headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  } catch (error) {
    if (claim && !claim.received)
      await ctx.db.assessmentFile
        .updateMany({
          where: { id: claim.row.id, status: "UPLOADING", updatedAt: claim.row.updatedAt },
          data: { status: "FAILED", failureCode: "TRANSFER" },
        })
        .catch(() => {});
    return failure(error instanceof Error ? error : new Error("UPLOAD_FAILURE"));
  }
}
export async function downloadAssessmentFile(ctx: Context, id: string): Promise<Response> {
  try {
    const row = await authorizedFile(staffContext(ctx), id);
    if (row.status !== "READY" || !row.bucket || !row.key)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "O arquivo ainda não está disponível. Consulte a fila de envios.",
      });
    const file = await getStorage().read({ bucket: row.bucket, key: row.key });
    return new Response(Buffer.from(file.bytes), {
      headers: {
        "Content-Type": row.contentType,
        "Content-Length": String(file.bytes.length),
        "Cache-Control": PRIVATE_CACHE,
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `attachment; filename="prova"; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
      },
    });
  } catch (error) {
    return failure(error instanceof Error ? error : new Error("DOWNLOAD_FAILURE"));
  }
}
