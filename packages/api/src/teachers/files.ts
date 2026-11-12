import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { getStorage } from "@lazuli/storage";
import { teacherFileUploadSchema, z } from "@lazuli/validators";
import type { Context } from "../trpc/context.js";
import { proofBytes, requireSameOrigin } from "../finance/payment-proof-transport.js";
import { readTeacher } from "./read.js";

const HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const fileSelect = {
  id: true,
  kind: true,
  label: true,
  subtitle: true,
  fileName: true,
  createdAt: true,
} as const;
function requireAdmin(ctx: Context): void {
  if (!ctx.staffUser || !["ADMIN", "SYSTEM_ADMIN"].includes(ctx.staffUser.role))
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito à administração." });
}
export async function listTeacherFiles(ctx: Context, teacherId: string) {
  requireAdmin(ctx);
  await readTeacher(ctx.db, teacherId);
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
    await readTeacher(ctx.db, input.teacherId);
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
        await readTeacher(tx, input.teacherId);
        await tx.teacherProfile.upsert({
          where: { userId: input.teacherId },
          create: { userId: input.teacherId },
          update: {},
        });
        if (input.kind === "PHOTO")
          await tx.teacherFile.updateMany({
            where: { teacherId: input.teacherId, kind: "PHOTO", deletedAt: null },
            data: { deletedAt: new Date() },
          });
        return tx.teacherFile.create({ data: { ...input, ...reference }, select: fileSelect });
      });
      return Response.json(file, { status: 201, headers: HEADERS });
    } catch (error) {
      await storage.remove(reference).catch(() => {});
      throw error;
    }
  } catch (error) {
    return fileFailure(error);
  }
}
export async function teacherFileResource(
  ctx: Context,
  request: Request,
  id: string,
): Promise<Response> {
  try {
    requireAdmin(ctx);
    if (!z.string().uuid().safeParse(id).success)
      throw new TRPCError({ code: "NOT_FOUND", message: "Arquivo não encontrado." });
    const file = await ctx.db.teacherFile.findFirst({ where: { id, deletedAt: null } });
    if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "Arquivo não encontrado." });
    if (file.teacherId) await readTeacher(ctx.db, file.teacherId);
    else {
      const session = await ctx.db.teacherUploadSession.findFirst({
        where: {
          id: file.uploadSessionId ?? "",
          createdById: ctx.staffUser?.id ?? "",
          deletedAt: null,
        },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Arquivo não encontrado." });
    }
    if (request.method === "DELETE") {
      requireSameOrigin(request);
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
    return fileFailure(error);
  }
}
function fileFailure(error: unknown): Response {
  const statuses: Record<string, number> = { FORBIDDEN: 403, NOT_FOUND: 404, BAD_REQUEST: 400 };
  const validation =
    error instanceof z.ZodError || error instanceof SyntaxError || error instanceof URIError;
  return Response.json(
    {
      message: validation
        ? "Informe o nome e escolha um PDF, JPG ou PNG de até 5 MB."
        : error instanceof TRPCError
          ? error.message
          : "Não foi possível acessar o arquivo. Tente novamente.",
    },
    {
      status: validation ? 400 : error instanceof TRPCError ? (statuses[error.code] ?? 500) : 500,
      headers: HEADERS,
    },
  );
}
