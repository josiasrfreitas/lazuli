import { activityListSchema } from "@lazuli/validators";
import { adminProcedure, router } from "../trpc/init.js";
import { listActivity } from "./read.js";

export const activityRouter = router({
  list: adminProcedure
    .input(activityListSchema)
    .query(({ ctx, input }) => listActivity(ctx.db, input, ctx.now ?? new Date())),
  actors: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.activityEvent.findMany({
      where: { deletedAt: null, actorId: { not: null } },
      distinct: ["actorId"],
      select: { actorId: true, actorName: true },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    });
    return rows
      .flatMap((row) => (row.actorId ? [{ id: row.actorId, name: row.actorName }] : []))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }),
});
