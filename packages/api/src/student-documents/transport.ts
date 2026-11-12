import { z } from "@lazuli/validators";
import { getStorage } from "@lazuli/storage";
import { enqueueStudentDocument } from "@lazuli/integrations/hatchet";
import type { Context } from "../trpc/context.js";
import { tokenHash } from "./router.js";
import { JPEG, PDF, documentFormat, readDocumentImage, storeDocument } from "./upload.js";
import { deleteStudentDocument } from "./delete.js";
const HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const KINDS = new Set(["student", "guardian", "residence", "payment", "photo"]);
const HTTP = {
  ok: 200,
  created: 201,
  badRequest: 400,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  gone: 410,
};
const TOKEN_LENGTH = 43;
function json<Value>(value: Value, status: number = HTTP.ok): Response {
  return Response.json(value, { status, headers: HEADERS });
}
function publicStatus(status: string): string {
  if (status === "READY") return "done";
  return status === "FAILED" ? "error" : "working";
}
export async function studentDocumentCapture(
  ctx: Context,
  input: { request: Request; kind?: string },
): Promise<Response> {
  const { request, kind } = input;
  const session = await captureSession(ctx, request);
  if (!session) return json({ code: "EXPIRED" }, HTTP.gone);
  if (request.method === "GET" && !kind) return readCaptureStatus(ctx, session.id);
  if (!kind || (!KINDS.has(kind) && !/^custom_[0-9a-f-]{36}$/.test(kind)))
    return json({ code: "NOT_FOUND" }, HTTP.notFound);
  switch (request.method) {
    case "DELETE": {
      return deleteCapture(ctx, { sessionId: session.id, kind });
    }
    case "GET": {
      return readCapture(ctx, { sessionId: session.id, kind });
    }
    case "POST": {
      return uploadCapture(ctx, { request, kind, session });
    }
    default: {
      return json({ code: "NOT_FOUND" }, HTTP.notFound);
    }
  }
}
async function captureSession(
  ctx: Context,
  request: Request,
): Promise<{ id: string; tokenHash: string } | null> {
  const token = readToken(request);
  if (!token || token.length !== TOKEN_LENGTH) return null;
  const session = await ctx.db.studentDocumentSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    select: { id: true, tokenHash: true, closedAt: true, deletedAt: true },
  });
  return session && !session.closedAt && !session.deletedAt ? session : null;
}
async function deleteCapture(
  ctx: Context,
  { sessionId, kind }: { sessionId: string; kind: string },
): Promise<Response> {
  const row = await ctx.db.studentDocumentFile.findFirst({
    where: { sessionId, kind, deletedAt: null },
  });
  if (!row) return json({ deleted: true });
  try {
    await deleteStudentDocument(ctx.db, { id: row.id, sessionId, requireOpen: true });
    return json({ deleted: true });
  } catch {
    return json({ code: "DELETE_FAILED" }, HTTP.conflict);
  }
}
async function readCapture(
  ctx: Context,
  { sessionId, kind }: { sessionId: string; kind: string },
): Promise<Response> {
  const row = await ctx.db.studentDocumentFile.findFirst({
    where: { sessionId, kind, deletedAt: null },
  });
  if (!row) return json({ code: "NOT_FOUND" }, HTTP.notFound);
  const file = await getStorage().read(row);
  return new Response(Buffer.from(file.bytes), {
    headers: { ...HEADERS, "Content-Type": documentFormat(row.key) === "pdf" ? PDF : JPEG },
  });
}
async function uploadCapture(
  ctx: Context,
  {
    request,
    kind,
    session,
  }: { request: Request; kind: string; session: { id: string; tokenHash: string } },
): Promise<Response> {
  let bytes;
  const contentType = request.headers.get("content-type") === PDF ? PDF : JPEG;
  try {
    if (kind === "photo" && contentType === PDF) throw new Error("IMAGE");
    bytes = await readDocumentImage(request);
  } catch {
    return json({ code: "INVALID_IMAGE" }, HTTP.badRequest);
  }
  try {
    const metadata = z
      .object({ title: z.string().trim().min(1).max(100), subtitle: z.string().trim().max(240) })
      .parse(
        JSON.parse(
          decodeURIComponent(
            request.headers.get("x-document-metadata") ??
              "%7B%22title%22%3A%22Documento%22%2C%22subtitle%22%3A%22%22%7D",
          ),
        ),
      );
    const file = await storeDocument(ctx.db, {
      ...metadata,
      sessionId: session.id,
      tokenHash: session.tokenHash,
      kind,
      bytes,
      contentType,
    });
    // A dispatch outage must not undo a durable upload; the recovery loop claims it.
    if (file.status === "RECEIVED")
      await enqueueStudentDocument({ fileId: file.id }).catch(() => {});
    return json(
      {
        status: publicStatus(file.status),
        revision: file.updatedAt.toISOString(),
        format: contentType === PDF ? "pdf" : "image",
      },
      HTTP.created,
    );
  } catch {
    return json({ code: "BUSY_OR_CLOSED" }, HTTP.conflict);
  }
}
async function readCaptureStatus(ctx: Context, sessionId: string): Promise<Response> {
  const files = await ctx.db.studentDocumentFile.findMany({
    where: { sessionId, deletedAt: null },
    select: { kind: true, status: true, updatedAt: true, extraction: true, key: true },
  });
  const documents = Object.fromEntries(
    files.map((file) => [
      file.kind,
      {
        status: publicStatus(file.status),
        revision: file.updatedAt.toISOString(),
        extraction: file.extraction,
        format: documentFormat(file.key),
      },
    ]),
  );
  return json({
    documents,
    status: files.some((file) => ["RECEIVED", "PROCESSING"].includes(file.status))
      ? "working"
      : "idle",
  });
}
export async function downloadStudentDocument(ctx: Context, id: string): Promise<Response> {
  if (!ctx.staffUser || !["ADMIN", "SYSTEM_ADMIN"].includes(ctx.staffUser.role))
    return json({ code: "FORBIDDEN" }, HTTP.forbidden);
  const row = await ctx.db.studentDocumentFile.findFirst({
    where: {
      id,
      deletedAt: null,
      session: { OR: [{ createdById: ctx.staffUser.id }, { studentId: { not: null } }] },
    },
  });
  if (!row) return json({ code: "NOT_FOUND" }, HTTP.notFound);
  const file = await getStorage().read(row);
  return new Response(Buffer.from(file.bytes), {
    headers: {
      ...HEADERS,
      "Content-Type": documentFormat(row.key) === "pdf" ? PDF : JPEG,
      "Content-Disposition": "inline",
    },
  });
}

function readToken(request: Request): string | undefined {
  return request.headers.get("authorization")?.replace(/^Bearer /u, "");
}
