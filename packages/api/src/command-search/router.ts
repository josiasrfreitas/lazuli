import { normalizeSearch } from "@lazuli/domain";
import { z } from "@lazuli/validators";
import { adminProcedure, router } from "../trpc/init.js";
import { lookupCommands } from "./read.js";

const MAX_QUERY_LENGTH = 100;

export const commandSearchRouter = router({
  lookup: adminProcedure
    .input(
      z
        .object({
          query: z
            .string()
            .trim()
            .min(2)
            .max(MAX_QUERY_LENGTH)
            .refine(
              (value) => normalizeSearch(value).length >= 2,
              "Digite pelo menos dois caracteres.",
            ),
        })
        .strict(),
    )
    .query(({ ctx, input }) =>
      lookupCommands(ctx.db, { query: input.query, now: ctx.now ?? new Date() }),
    ),
});
