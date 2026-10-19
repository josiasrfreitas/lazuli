import { z } from "@lazuli/validators";
import { router, staffProcedure } from "../trpc/init.js";
import { enqueueAssessmentFile } from "@lazuli/integrations/hatchet";
import { authorizedFile, filesForProgress, fileView } from "./data.js";
import { badRequest } from "../trpc/errors.js";
import { loadAppointment } from "../appointments/data.js";
const byId = z.object({ id: z.string().uuid() }).strict();
export const assessmentFilesRouter = router({
  list: staffProcedure.input(z.object({ progressId: z.string().uuid() }).strict()).query(({ ctx, input }) => filesForProgress({ database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() }, input.progressId)),
  recent: staffProcedure.query(({ ctx }) => ctx.db.assessmentFile.findMany({ where: { uploadedById: ctx.staffUser.id, removedAt: null }, select: fileView, orderBy: { createdAt: "desc" }, take: 50 })),
  appointment: staffProcedure.input(byId).query(async ({ ctx, input }) => {
    await loadAppointment({ database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() }, input.id);
    return ctx.db.assessmentFile.findMany({ where: { appointmentId: input.id, removedAt: null }, select: fileView, orderBy: { createdAt: "asc" } });
  }),
  retry: staffProcedure.input(byId).mutation(async ({ ctx, input }) => {
    const row = await authorizedFile({ database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() }, input.id);
    if (!row.receivedAt || !row.bucket || !row.key || row.status === "REJECTED") throw badRequest("Selecione novamente o arquivo original para reenviar.");
    await ctx.db.assessmentFile.updateMany({ where: { id: row.id, status: "FAILED" }, data: { status: "RECEIVED", failureCode: null } });
    await enqueueAssessmentFile({ fileId: row.id }).catch(() => undefined);
    return { id: row.id };
  }),
  remove: staffProcedure.input(byId.extend({ reason: z.string().trim().min(3).max(500) })).mutation(async ({ ctx, input }) => {
    const row = await authorizedFile({ database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() }, input.id);
    if (ctx.staffUser.role === "TEACHER" && row.uploadedById !== ctx.staffUser.id) throw badRequest("Somente o autor ou a administração pode retirar este anexo.");
    await ctx.db.assessmentFile.update({ where: { id: row.id }, data: { status: "REMOVED", removedAt: ctx.now ?? new Date(), removedById: ctx.staffUser.id, removalReason: input.reason } });
    return { id: row.id };
  }),
});
