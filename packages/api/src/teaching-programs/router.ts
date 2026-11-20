import { adminProcedure, router } from "../trpc/init.js";
import { z } from "@lazuli/validators";
import { readStageCatalog, readStageProgram } from "./read.js";

import { catalogCommand, catalogDirectory, editCatalog } from "./catalog-editor.js";
import { programCommand, editProgram } from "./program-editor.js";

export const teachingProgramsRouter = router({
  directory: adminProcedure.query(({ ctx }) => catalogDirectory(ctx.db, ctx.now ?? new Date())),
  editCatalog: adminProcedure
    .input(catalogCommand)
    .mutation(({ ctx, input }) => editCatalog(ctx.db, input)),
  editProgram: adminProcedure
    .input(programCommand)
    .mutation(({ ctx, input }) => editProgram(ctx.db, input)),
  detail: adminProcedure
    .input(z.object({ id: z.string().uuid() }).strict())
    .query(({ ctx, input }) => readStageProgram(ctx.db, input.id)),
  catalog: adminProcedure.query(({ ctx }) => readStageCatalog(ctx.db)),
});
