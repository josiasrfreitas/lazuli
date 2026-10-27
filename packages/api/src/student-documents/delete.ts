import { Prisma } from "@lazuli/db/prisma";
import type { DatabaseClient } from "@lazuli/db";
import { getStorage } from "@lazuli/storage";
import { badRequest } from "../trpc/errors.js";

/** Serialize with uploads so a replacement cannot be removed by a stale deletion. */
export async function deleteStudentDocument(
  database: DatabaseClient,
  input: { id: string; sessionId: string; requireOpen?: boolean },
): Promise<void> {
  await database.$transaction(async (transaction) => {
    const locked = await transaction.studentDocumentSession.updateMany({
      where: {
        id: input.sessionId,
        deletedAt: null,
        ...(input.requireOpen ? { closedAt: null } : {}),
      },
      data: { updatedAt: new Date() },
    });
    if (!locked.count) throw badRequest("A sessão foi encerrada.");
    const file = await transaction.studentDocumentFile.findFirst({
      where: { id: input.id, sessionId: input.sessionId, deletedAt: null },
    });
    if (!file) return;
    await transaction.studentDocumentFile.update({
      where: { id: file.id },
      data: { deletedAt: new Date(), extraction: Prisma.DbNull },
    });
    await getStorage().remove(file);
  });
}
