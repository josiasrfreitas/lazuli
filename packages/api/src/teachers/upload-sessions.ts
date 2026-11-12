import { createHash, randomBytes, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { getStorage } from "@lazuli/storage";
import type { Prisma } from "@lazuli/db";
import { z, teacherFileUploadSchema } from "@lazuli/validators";
import { adminProcedure, router } from "../trpc/init.js";
import type { Context } from "../trpc/context.js";
import { proofBytes } from "../finance/payment-proof-transport.js";
import { readTeacher } from "./read.js";

const SESSION_MS = 60 * 60 * 1000;
const hash = (token: string): string => createHash("sha256").update(token).digest("hex");
const sessionIdSchema = z.object({ id: z.string().uuid() }).strict();
const fileSelect = { id: true, kind: true, label: true, fileName: true, createdAt: true } as const;
const HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
export const teacherUploadsRouter = router({
  create: adminProcedure
    .input(z.object({ teacherId: z.string().uuid().optional() }).strict())
    .mutation(async ({ ctx, input }) => {
      if (input.teacherId) {
        await readTeacher(ctx.db, input.teacherId);
        await ctx.db.teacherProfile.upsert({
          where: { userId: input.teacherId },
          create: { userId: input.teacherId },
          update: {},
        });
      }
      const token = randomBytes(32).toString("base64url");
      const session = await ctx.db.teacherUploadSession.create({
        data: {
          createdById: ctx.staffUser.id,
          teacherId: input.teacherId ?? null,
          tokenHash: hash(token),
          expiresAt: new Date(Date.now() + SESSION_MS),
        },
        select: { id: true, expiresAt: true },
      });
      return { ...session, token };
    }),
  status: adminProcedure.input(sessionIdSchema).query(async ({ ctx, input }) => {
    const session = await ctx.db.teacherUploadSession.findFirst({
      where: { id: input.id, createdById: ctx.staffUser.id, deletedAt: null },
    });
    if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão não encontrada." });
    const files = await ctx.db.teacherFile.findMany({
      where: {
        deletedAt: null,
        ...(session.teacherId ? { teacherId: session.teacherId } : { uploadSessionId: session.id }),
      },
      select: fileSelect,
      orderBy: { createdAt: "desc" },
    });
    return { files, closed: Boolean(session.closedAt) || session.expiresAt <= new Date() };
  }),
  close: adminProcedure.input(sessionIdSchema).mutation(async ({ ctx, input }) => {
    await ctx.db.$transaction(async (tx) => {
      await lockSession(tx, input.id);
      await tx.teacherUploadSession.updateMany({
        where: { id: input.id, createdById: ctx.staffUser.id },
        data: { closedAt: new Date() },
      });
    });
    return { closed: true };
  }),
});
async function lockSession(tx: Prisma.TransactionClient, id: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 235))`;
}
export async function attachTeacherUploads(
  tx: Prisma.TransactionClient,
  input: { sessionId?: string | undefined; teacherId: string; ownerId?: string | undefined },
): Promise<void> {
  if (!input.sessionId) return;
  await lockSession(tx, input.sessionId);
  const session = await tx.teacherUploadSession.findFirst({
    where: {
      id: input.sessionId,
      createdById: input.ownerId ?? "",
      deletedAt: null,
      OR: [{ teacherId: null }, { teacherId: input.teacherId }],
    },
  });
  if (!session)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A sessão de documentos pertence a outro cadastro.",
    });
  await tx.teacherUploadSession.update({
    where: { id: session.id },
    data: { teacherId: input.teacherId, closedAt: new Date() },
  });
  await tx.teacherFile.updateMany({
    where: { uploadSessionId: session.id, teacherId: null },
    data: { teacherId: input.teacherId },
  });
}
export async function teacherMobileCapture(ctx: Context, request: Request): Promise<Response> {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer /u, "") ?? "";
    if (token.length !== 43) return expired();
    const session = await ctx.db.teacherUploadSession.findUnique({
      where: { tokenHash: hash(token) },
    });
    if (!session || session.closedAt || session.deletedAt || session.expiresAt <= new Date())
      return expired();
    if (session.teacherId) await readTeacher(ctx.db, session.teacherId);
    if (request.method === "GET") {
      // A phone sees only files uploaded through its capability, never the teacher's existing records.
      const files = await ctx.db.teacherFile.findMany({
        where: { uploadSessionId: session.id, deletedAt: null },
        select: fileSelect,
        orderBy: { createdAt: "desc" },
      });
      return Response.json({ files, expiresAt: session.expiresAt }, { headers: HEADERS });
    }
    const url = new URL(request.url);
    const fileId = url.searchParams.get("file");
    if (request.method === "DELETE" && fileId) {
      await ctx.db.$transaction(async (tx) => {
        await lockSession(tx, session.id);
        await requireOpen(tx, session.id);
        await tx.teacherFile.updateMany({
          where: {
            id: z.string().uuid().parse(fileId),
            uploadSessionId: session.id,
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        });
      });
      return Response.json({ deleted: true }, { headers: HEADERS });
    }
    if (request.method !== "POST")
      return Response.json({ message: "Operação inválida." }, { status: 405, headers: HEADERS });
    const metadata: unknown = JSON.parse(
      decodeURIComponent(request.headers.get("x-upload-metadata") ?? ""),
    );
    const input = teacherFileUploadSchema.parse({
      ...z.record(z.unknown()).parse(metadata),
      teacherId: session.teacherId ?? session.id,
    });
    if (request.headers.get("content-type") !== input.contentType)
      throw new Error("Formato inválido.");
    const bytes = await proofBytes(request, input);
    const storage = getStorage();
    const reference = await storage.put({
      key: `teacher-files/${randomUUID()}`,
      contentType: input.contentType,
      bytes,
    });
    try {
      const file = await ctx.db.$transaction(async (tx) => {
        await lockSession(tx, session.id);
        const active = await requireOpen(tx, session.id);
        if (active.teacherId) {
          await readTeacher(tx, active.teacherId);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${active.teacherId}, 234))`;
        }
        if (input.kind === "PHOTO")
          await tx.teacherFile.updateMany({
            where: {
              deletedAt: null,
              kind: "PHOTO",
              ...(active.teacherId
                ? { teacherId: active.teacherId }
                : { uploadSessionId: session.id }),
            },
            data: { deletedAt: new Date() },
          });
        return tx.teacherFile.create({
          data: {
            ...input,
            teacherId: active.teacherId,
            uploadSessionId: session.id,
            ...reference,
          },
          select: fileSelect,
        });
      });
      return Response.json(file, { status: 201, headers: HEADERS });
    } catch (error) {
      await storage.remove(reference).catch(() => {});
      throw error;
    }
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") return expired();
    return Response.json(
      {
        message:
          error instanceof TRPCError
            ? error.message
            : "Não foi possível enviar. Escolha PDF, JPG ou PNG de até 5 MB.",
      },
      {
        status: error instanceof TRPCError && error.code === "NOT_FOUND" ? 404 : 400,
        headers: HEADERS,
      },
    );
  }
}
async function requireOpen(tx: Prisma.TransactionClient, id: string) {
  const session = await tx.teacherUploadSession.findFirst({
    where: { id, closedAt: null, deletedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!session) throw new TRPCError({ code: "FORBIDDEN", message: "Sessão encerrada." });
  return session;
}
function expired(): Response {
  return Response.json(
    { message: "Sessão encerrada. Abra um novo QR code no cadastro." },
    { status: 410, headers: HEADERS },
  );
}
