import { TRPCError } from "@trpc/server";
import { dispatchTableExport } from "@lazuli/integrations/hatchet";
import { getStorage } from "@lazuli/storage";
import {
  deriveArtifactStatus,
  getArtifactInputSchema,
  tableExportSchema,
} from "@lazuli/validators";
import type { Context } from "../trpc/context.js";
import { adminProcedure } from "../trpc/init.js";

const MILLISECONDS_PER_DAY = 86_400_000;
const EXPORT_LIFETIME_MS = MILLISECONDS_PER_DAY;

export const requestTableExport = adminProcedure
  .input(tableExportSchema)
  .mutation(async ({ ctx, input }) => {
    const artifact = await ctx.db.generatedArtifact.create({
      data: {
        kind: "TABLE_XLSX",
        requestedById: ctx.staffUser.id,
        exportRequest: input,
        expiresAt: new Date(Date.now() + EXPORT_LIFETIME_MS),
        fileName: "Lazuli - " + input.source.listing + ".xlsx",
      },
      select: { id: true },
    });
    try {
      await dispatchTableExport(artifact.id);
    } catch {
      await ctx.db.generatedArtifact.updateMany({
        where: { id: artifact.id, startedAt: null },
        data: { failedAt: new Date(), errorCode: "DISPATCH_FAILED" },
      });
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: "Não foi possível iniciar a exportação.",
      });
    }
    return artifact;
  });

export const tableExportStatus = adminProcedure
  .input(getArtifactInputSchema)
  .query(async ({ ctx, input }) => {
    const row = await ctx.db.generatedArtifact.findFirst({
      where: { id: input.id, kind: "TABLE_XLSX", requestedById: ctx.staffUser.id, deletedAt: null },
      select: { startedAt: true, completedAt: true, failedAt: true },
    });
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    return deriveArtifactStatus(row);
  });

export async function downloadTableExport(ctx: Context, id: string): Promise<Response> {
  const user = ctx.staffUser;
  if (!user || (user.role !== "ADMIN" && user.role !== "SYSTEM_ADMIN"))
    return new Response(null, { status: 403 });
  if (!getArtifactInputSchema.safeParse({ id }).success) return new Response(null, { status: 404 });
  const row = await ctx.db.generatedArtifact.findFirst({
    where: {
      id,
      kind: "TABLE_XLSX",
      requestedById: user.id,
      deletedAt: null,
      expiresAt: { gt: new Date() },
      completedAt: { not: null },
      failedAt: null,
    },
  });
  if (!row?.storageBucket || !row.storageObject || !row.fileName)
    return new Response(null, { status: 404 });
  const file = await getStorage().read({ bucket: row.storageBucket, key: row.storageObject });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(row.fileName),
      "Cache-Control": "private, no-store",
    },
  });
}
