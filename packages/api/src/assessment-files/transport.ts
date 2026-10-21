import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { getStorage } from "@lazuli/storage";
import { MAX_UPLOAD_FILE_MB } from "@lazuli/validators";
import { enqueueAssessmentFile } from "@lazuli/integrations/hatchet";
import type { Context } from "../trpc/context.js";
import { authorizedFile, fileInputSchema, MAX_ASSESSMENT_BYTES, prepareFile } from "./data.js";

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
  const reader = request.body?.getReader();
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
function failure(error: unknown): Response {
  const known = error instanceof TRPCError;
  return Response.json(
    { message: known ? error.message : "Não foi possível concluir o envio. Tente novamente." },
    {
      status:
        known && error.code === "UNAUTHORIZED"
          ? 401
          : known && error.code === "FORBIDDEN"
            ? 403
            : known && error.code === "NOT_FOUND"
              ? 404
              : known
                ? 400
                : 500,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
export async function receiveAssessmentFile(ctx: Context, request: Request): Promise<Response> {
  let claim: Awaited<ReturnType<typeof prepareFile>> | undefined;
  try {
    const context = staffContext(ctx);
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
    const parsed = fileInputSchema.safeParse(
      header ? JSON.parse(decodeURIComponent(header)) : null,
    );
    if (!parsed.success)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Escolha uma foto JPG/PNG ou PDF de até ${MAX_UPLOAD_FILE_MB} MB.`,
      });
    claim = await ctx.db.$transaction((database) =>
      prepareFile({ ...context, database }, parsed.data),
    );
    if (claim.received) return Response.json({ id: claim.row.id, status: claim.row.status });
    const bytes = await readBytes(request, parsed.data.byteLength);
    const reference = await getStorage().put({
      key: `academic-assessments/${randomUUID()}`,
      bytes,
      contentType: parsed.data.contentType,
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
    return Response.json(
      { id: claim.row.id, status: "RECEIVED" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (claim && !claim.received)
      await ctx.db.assessmentFile
        .updateMany({
          where: { id: claim.row.id, status: "UPLOADING", updatedAt: claim.row.updatedAt },
          data: { status: "FAILED", failureCode: "TRANSFER" },
        })
        .catch((): undefined => {});
    return failure(error);
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
    return failure(error);
  }
}
