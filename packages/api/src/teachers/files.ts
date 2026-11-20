import { reportTransportError } from "../telemetry.js";
import type { Prisma } from "@lazuli/db";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { getStorage } from "@lazuli/storage";
import { teacherFileUploadSchema, z } from "@lazuli/validators";
import type { Context } from "../trpc/context.js";
import { proofBytes, requireSameOrigin } from "../finance/payment-proof-transport.js";
import { readEmployee, requireEmployeeEditor } from "../employees/read.js";

const NOT_FOUND_MESSAGE = "Arquivo não encontrado.";
const BAD_REQUEST_STATUS = 400;
const SERVER_ERROR_STATUS = 500;
const HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const fileSelect = {
  id: true,
  kind: true,
  label: true,
  subtitle: true,
  fileName: true,
  contentType: true,
  createdAt: true,
} as const;
function requireAdmin(ctx: Context): void {
  if (!ctx.staffUser || !["ADMIN", "SYSTEM_ADMIN"].includes(ctx.staffUser.role))
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito à administração." });
}
export async function listTeacherFiles(
  ctx: Context,
  teacherId: string,
): Promise<Prisma.TeacherFileGetPayload<{ select: typeof fileSelect }>[]> {
  requireAdmin(ctx);
  await readEmployee(ctx.db, teacherId);
  return ctx.db.teacherFile.findMany({
    where: { teacherId, deletedAt: null },
    select: fileSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}
export async function receiveTeacherFile(ctx: Context, request: Request): Promise<Response> {
  try {
    requireAdmin(ctx);
    requireSameOrigin(request);
    const input = teacherFileUploadSchema.parse(
      JSON.parse(decodeURIComponent(request.headers.get("x-upload-metadata") ?? "")),
    );
    if (request.headers.get("content-type") !== input.contentType)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Formato de arquivo inválido." });
    const target = await readEmployee(ctx.db, input.teacherId);
    requireEmployeeEditor(target.role, ctx.staffUser?.role);
    const bytes = await proofBytes(request, input);
    const storage = getStorage();
    const reference = await storage.put({
      key: `teacher-files/${randomUUID()}`,
      bytes,
      contentType: input.contentType,
    });
    try {
      const file = await ctx.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.teacherId}, 234))`;
        const target = await readEmployee(tx, input.teacherId);
        requireEmployeeEditor(target.role, ctx.staffUser?.role);
        if (input.kind === "PHOTO")
          await tx.teacherFile.updateMany({
            where: { teacherId: input.teacherId, kind: "PHOTO", deletedAt: null },
            data: { deletedAt: new Date() },
          });
        return tx.teacherFile.create({
          data: { ...input, subtitle: input.subtitle ?? null, ...reference },
          select: fileSelect,
        });
      });
      return Response.json(file, { status: 201, headers: HEADERS });
    } catch (error) {
      await storage.remove(reference).catch(() => {});
      throw error;
    }
  } catch (error) {
    return fileFailure(error instanceof Error ? error : null);
  }
}
export async function teacherFileResource(
  ctx: Context,
  { request, id }: { request: Request; id: string },
): Promise<Response> {
  try {
    requireAdmin(ctx);
    if (!z.string().uuid().safeParse(id).success)
      throw new TRPCError({ code: "NOT_FOUND", message: NOT_FOUND_MESSAGE });
    const file = await ctx.db.teacherFile.findFirst({ where: { id, deletedAt: null } });
    if (!file) throw new TRPCError({ code: "NOT_FOUND", message: NOT_FOUND_MESSAGE });
    await requireFileAccess(ctx, file);
    if (request.method === "DELETE") {
      requireSameOrigin(request);
      if (file.teacherId) {
        const target = await readEmployee(ctx.db, file.teacherId);
        requireEmployeeEditor(target.role, ctx.staffUser?.role);
      }
      await ctx.db.teacherFile.update({ where: { id }, data: { deletedAt: new Date() } });
      return Response.json({ deleted: true }, { headers: HEADERS });
    }
    const stored = await getStorage().read(file);
    return new Response(Buffer.from(stored.bytes), {
      headers: {
        ...HEADERS,
        "Content-Type": file.contentType,
        "Content-Disposition":
          file.kind === "PHOTO"
            ? "inline"
            : `attachment; filename="documento"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      },
    });
  } catch (error) {
    return fileFailure(error instanceof Error ? error : null);
  }
}
function fileFailure(error: Error | null): Response {
  const statuses: Record<string, number> = {
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    BAD_REQUEST: BAD_REQUEST_STATUS,
  };
  if (error instanceof z.ZodError || error instanceof SyntaxError || error instanceof URIError)
    return Response.json(
      { message: "Informe o nome e escolha um PDF, JPG ou PNG de até 5 MB." },
      { status: BAD_REQUEST_STATUS, headers: HEADERS },
    );
  reportTransportError(error, "teacher-file");
  if (error instanceof TRPCError)
    return Response.json(
      { message: error.message },
      { status: statuses[error.code] ?? SERVER_ERROR_STATUS, headers: HEADERS },
    );
  return Response.json(
    { message: "Não foi possível acessar o arquivo. Tente novamente." },
    { status: SERVER_ERROR_STATUS, headers: HEADERS },
  );
}

async function requireFileAccess(
  ctx: Context,
  file: { teacherId: string | null; uploadSessionId: string | null },
): Promise<void> {
  if (file.teacherId) await readEmployee(ctx.db, file.teacherId);
  else {
    const session = await ctx.db.teacherUploadSession.findFirst({
      where: {
        id: file.uploadSessionId ?? "",
        createdById: ctx.staffUser?.id ?? "",
        deletedAt: null,
      },
    });
    if (!session) throw new TRPCError({ code: "NOT_FOUND", message: NOT_FOUND_MESSAGE });
  }
}
