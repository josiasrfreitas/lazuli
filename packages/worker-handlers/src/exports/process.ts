import type { DatabaseClient } from "@lazuli/db";
import { getStorage } from "@lazuli/storage";
import { tableExportSchema } from "@lazuli/validators";
import { readExport } from "./listings.js";
import { buildWorkbook } from "./workbook.js";

const TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function processTableExport(
  db: DatabaseClient,
  id: string,
): Promise<{ status: string }> {
  const where = {
    id,
    kind: "TABLE_XLSX" as const,
    deletedAt: null,
    expiresAt: { gt: new Date() },
    completedAt: null,
    failedAt: null,
  };
  const artifact = await db.generatedArtifact.findFirst({ where });
  if (!artifact) return { status: "SKIPPED" };
  const startedAt = new Date();
  const claim = await db.generatedArtifact.updateMany({
    where: { ...where, startedAt: null },
    data: { startedAt },
  });
  if (!claim.count) return { status: "SKIPPED" };
  try {
    const request = tableExportSchema.parse(artifact.exportRequest);
    const actor = artifact.requestedById;
    if (!actor) throw new Error("EXPORT_ACCESS_DENIED");
    const data = await db.$transaction(
      async (tx) => {
        const user = await tx.user.findFirst({
          where: {
            id: actor,
            isEnabled: true,
            deletedAt: null,
            role: { in: ["ADMIN", "SYSTEM_ADMIN"] },
          },
          select: { id: true },
        });
        if (!user) throw new Error("EXPORT_ACCESS_DENIED");
        return readExport(tx, request.source, actor, artifact.requestedAt);
      },
      { isolationLevel: "RepeatableRead", timeout: 180_000 },
    );
    const bytes = await buildWorkbook(request, data);
    const file = await getStorage().put({
      key: "table-exports/" + id + "/" + startedAt.getTime() + ".xlsx",
      contentType: TYPE,
      bytes,
    });
    const committed = await db.generatedArtifact.updateMany({
      where: { ...where, startedAt },
      data: {
        storageBucket: file.bucket,
        storageObject: file.key,
        contentType: TYPE,
        completedAt: new Date(),
      },
    });
    if (!committed.count) await getStorage().remove(file);
    return { status: committed.count ? "COMPLETED" : "SKIPPED" };
  } catch {
    await db.generatedArtifact.updateMany({
      where: { ...where, startedAt },
      data: { failedAt: new Date(), errorCode: "EXPORT_FAILED" },
    });
    throw new Error("TABLE_EXPORT_FAILED");
  }
}

/** The existing daily file recovery job also disposes of expired private exports. */
export async function removeExpiredTableExports(db: DatabaseClient): Promise<void> {
  const cutoff = new Date();
  for (;;) {
    const rows = await db.generatedArtifact.findMany({
      where: { kind: "TABLE_XLSX", deletedAt: null, expiresAt: { lte: cutoff } },
      select: { id: true, storageBucket: true, storageObject: true },
      take: 50,
      orderBy: { id: "asc" },
    });
    if (!rows.length) return;
    for (const row of rows) {
      if (row.storageBucket && row.storageObject) {
        await getStorage().remove({ bucket: row.storageBucket, key: row.storageObject });
      }
      await db.generatedArtifact.delete({ where: { id: row.id } });
    }
  }
}
