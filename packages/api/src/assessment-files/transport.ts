import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { getStorage } from "@lazuli/storage";
import { MAX_UPLOAD_FILE_MB } from "@lazuli/validators";
import { enqueueAssessmentFile } from "@lazuli/integrations/hatchet";
import type { Context } from "../trpc/context.js";
import {
  authorizedFile,
  fileInputSchema,
  MAX_ASSESSMENT_BYTES,
  prepareFile,
  type FileInput,
  type PreparedFileClaim,
} from "./data.js";

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_REQUEST = 400;
const HTTP_INTERNAL_SERVER_ERROR = 500;

function staffContext(ctx: Context): {
  database: Context["db"];
  staffUser: NonNullable<Context["staffUser"]>;
  now: Date;
} {
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
const PRIVATE_FILE_HEADERS = { "Cache-Control": "private, no-store" };

function failureStatus(error: TRPCError | null): number {
  switch (error?.code) {
    case "UNAUTHORIZED": {
      return HTTP_UNAUTHORIZED;
    }
    case "FORBIDDEN": {
      return HTTP_FORBIDDEN;
    }
    case "NOT_FOUND": {
      return HTTP_NOT_FOUND;
    }
    default: {
      return error ? HTTP_BAD_REQUEST : HTTP_INTERNAL_SERVER_ERROR;
    }
  }
}
function failure(error: TRPCError | null): Response {
  return Response.json(
    { message: error ? error.message : "Não foi possível concluir o envio. Tente novamente." },
    {
      status: failureStatus(error),
      headers: PRIVATE_FILE_HEADERS,
    },
  );
}
function assertSameOrigin(request: Request): void {
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
}
function readUploadInput(request: Request): FileInput {
  const header = request.headers.get("x-upload-metadata");
  const parsed = fileInputSchema.safeParse(header ? JSON.parse(decodeURIComponent(header)) : null);
  if (!parsed.success)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Escolha uma foto JPG/PNG ou PDF de até ${MAX_UPLOAD_FILE_MB} MB.`,
    });
  return parsed.data;
}
async function completeUpload(
  ctx: Context,
  { claim, input, request }: { claim: PreparedFileClaim; input: FileInput; request: Request },
): Promise<Response> {
  const bytes = await readBytes(request, input.byteLength);
  const reference = await getStorage().put({
    key: `academic-assessments/${randomUUID()}`,
    bytes,
    contentType: input.contentType,
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
      .catch((): undefined => {});
    throw error;
  }
  // The durable database row remains RECEIVED if dispatch is unavailable; the worker recovers it.
  await enqueueAssessmentFile({ fileId: claim.row.id }).catch((): undefined => {});
  return Response.json({ id: claim.row.id, status: "RECEIVED" }, { headers: PRIVATE_FILE_HEADERS });
}
export async function receiveAssessmentFile(ctx: Context, request: Request): Promise<Response> {
  let claim: PreparedFileClaim | undefined;
  try {
    const context = staffContext(ctx);
    assertSameOrigin(request);
    const input = readUploadInput(request);
    claim = await ctx.db.$transaction((database) => prepareFile({ ...context, database }, input));
    if (claim.received) return Response.json({ id: claim.row.id, status: claim.row.status });
    return await completeUpload(ctx, { claim, input, request });
  } catch (error) {
    if (claim && !claim.received)
      await ctx.db.assessmentFile
        .updateMany({
          where: { id: claim.row.id, status: "UPLOADING", updatedAt: claim.row.updatedAt },
          data: { status: "FAILED", failureCode: "TRANSFER" },
        })
        .catch((): undefined => {});
    return failure(error instanceof TRPCError ? error : null);
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
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `attachment; filename="prova"; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
      },
    });
  } catch (error) {
    return failure(error instanceof TRPCError ? error : null);
  }
}
