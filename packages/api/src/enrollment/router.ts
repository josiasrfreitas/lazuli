import { enrollmentCreateInputSchema } from "@lazuli/validators";

import { adminProcedure, router } from "../trpc/init.js";
import { createEnrollment } from "./data.js";

export const enrollmentRouter = router({
  create: adminProcedure
    .input(enrollmentCreateInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => createEnrollment({ database, values: input })),
    ),
});
