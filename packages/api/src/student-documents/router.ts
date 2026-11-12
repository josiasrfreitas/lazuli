import { createHash, randomBytes } from "node:crypto";
import { z } from "@lazuli/validators";
import { createServiceLogger, logDevelopmentProcess } from "@lazuli/logging";
import type { TransactionClient } from "@lazuli/db";
import { adminProcedure, router } from "../trpc/init.js";
import { badRequest } from "../trpc/errors.js";
import { documentFormat } from "./upload.js";
import { deleteStudentDocument } from "./delete.js";

const TOKEN_BYTES = 32;
const processLogger = createServiceLogger("web");

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export const studentDocumentsRouter = router({
  list: adminProcedure
    .input(z.object({ studentId: z.string().uuid() }).strict())
    .query(async ({ ctx, input }) => {
      const files = await ctx.db.studentDocumentFile.findMany({
        where: {
          deletedAt: null,
          session: { studentId: input.studentId, student: { deletedAt: null } },
        },
        select: {
          id: true,
          kind: true,
          title: true,
          subtitle: true,
          status: true,
          updatedAt: true,
          key: true,
        },
        orderBy: { updatedAt: "desc" },
      });
      return files.map(({ key, ...file }) => ({ ...file, format: documentFormat(key) }));
    }),
  remove: adminProcedure
    .input(z.object({ id: z.string().uuid() }).strict())
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.db.studentDocumentFile.findFirst({
        where: {
          id: input.id,
          deletedAt: null,
          session: {
            OR: [
              { createdById: ctx.staffUser.id },
              { studentId: { not: null }, student: { deletedAt: null } },
            ],
          },
        },
        select: { id: true, sessionId: true },
      });
      if (!file) throw badRequest("Anexo não encontrado.");
      await deleteStudentDocument(ctx.db, file);
      return { deleted: true };
    }),
  photo: adminProcedure
    .input(z.object({ studentId: z.string().uuid() }).strict())
    .query(({ ctx, input }) =>
      ctx.db.studentDocumentFile.findFirst({
        where: {
          kind: "photo",
          status: "READY",
          deletedAt: null,
          session: { studentId: input.studentId },
        },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
    ),
  create: adminProcedure
    .input(z.object({ studentId: z.string().uuid().optional() }).strict())
    .mutation(async ({ ctx, input }) => {
      if (
        input.studentId &&
        !(await ctx.db.student.findFirst({
          where: { id: input.studentId, deletedAt: null },
          select: { id: true },
        }))
      )
        throw badRequest("Aluno não encontrado.");
      const token = randomBytes(TOKEN_BYTES).toString("base64url");
      const session = await ctx.db.studentDocumentSession.create({
        data: {
          tokenHash: tokenHash(token),
          createdById: ctx.staffUser.id,
          ...(input.studentId ? { studentId: input.studentId } : {}),
        },
        select: { id: true },
      });
      logDevelopmentProcess(processLogger, {
        requestId: ctx.requestId,
        userId: ctx.staffUser.id,
        resource: "studentDocuments.create",
        operation: "DB",
        step: "Private document upload session created",
        facts: { student_linked: Boolean(input.studentId) },
      });
      return { id: session.id, token };
    }),
  status: adminProcedure
    .input(z.object({ id: z.string().uuid() }).strict())
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.studentDocumentSession.findFirst({
        where: { id: input.id, createdById: ctx.staffUser.id, deletedAt: null },
        select: { studentId: true, closedAt: true },
      });
      if (!session) throw badRequest("Sessão não encontrada.");
      const files = await ctx.db.studentDocumentFile.findMany({
        where: session.studentId
          ? { deletedAt: null, session: { studentId: session.studentId } }
          : { deletedAt: null, sessionId: input.id },
        select: {
          id: true,
          sessionId: true,
          kind: true,
          title: true,
          subtitle: true,
          status: true,
          extraction: true,
          updatedAt: true,
          key: true,
        },
        orderBy: { updatedAt: "asc" },
      });
      logDevelopmentProcess(processLogger, {
        requestId: ctx.requestId,
        userId: ctx.staffUser.id,
        resource: "studentDocuments.status",
        operation: "DB",
        step: "Document upload session checked",
        facts: { documents: files.length, session_closed: Boolean(session.closedAt) },
      });
      return {
        closed: Boolean(session.closedAt),
        files: files.map(({ key, ...file }) => ({ ...file, format: documentFormat(key) })),
      };
    }),
  close: adminProcedure
    .input(z.object({ id: z.string().uuid() }).strict())
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.studentDocumentSession.updateMany({
        where: { id: input.id, createdById: ctx.staffUser.id },
        data: { closedAt: new Date() },
      });
      logDevelopmentProcess(processLogger, {
        requestId: ctx.requestId,
        userId: ctx.staffUser.id,
        resource: "studentDocuments.close",
        operation: "DB",
        step: "Private document upload session closure processed",
        facts: { sessions_updated: result.count },
      });
      return { closed: true };
    }),
});
/** Called inside enrollment's transaction: a failed save cannot orphan the attachment link. */
export async function attachDocumentSession(
  database: TransactionClient,
  {
    sessionId,
    studentId,
    ownerId,
  }: { sessionId: string | undefined; studentId: string; ownerId: string },
): Promise<void> {
  if (!sessionId) return;
  const changed = await database.studentDocumentSession.updateMany({
    where: { id: sessionId, createdById: ownerId, OR: [{ studentId: null }, { studentId }] },
    data: { studentId, closedAt: new Date() },
  });
  if (!changed.count) throw badRequest("A sessão de documentos pertence a outro cadastro.");
}
