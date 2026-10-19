import { normalizeSearch } from "@lazuli/domain";
import { z } from "@lazuli/validators";
import { adminProcedure, router } from "../trpc/init.js";
import { lookupCommands } from "./read.js";

export const commandSearchRouter = router({
  lookup: adminProcedure
    .input(
      z
        .object({
          query: z
            .string()
            .trim()
            .min(2)
            .max(100)
            .refine(
              (value) => normalizeSearch(value).length >= 2,
              "Digite pelo menos dois caracteres.",
            ),
        })
        .strict(),
    )
    .query(({ ctx, input }) => lookupCommands(ctx.db, input.query, ctx.now ?? new Date())),
});
