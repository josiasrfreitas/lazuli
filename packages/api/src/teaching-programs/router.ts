import { adminProcedure, router } from "../trpc/init.js";
import { z } from "@lazuli/validators";
import { readStageCatalog, readStageProgram } from "./read.js";

export const teachingProgramsRouter = router({
  detail: adminProcedure
    .input(z.object({ id: z.string().uuid() }).strict())
    .query(({ ctx, input }) => readStageProgram(ctx.db, input.id)),
  catalog: adminProcedure.query(({ ctx }) => readStageCatalog(ctx.db)),
});
