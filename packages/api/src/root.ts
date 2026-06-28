import { createCallerFactory, protectedProcedure, publicProcedure, router } from "./trpc/init.js";

export const appRouter = router({
  health: publicProcedure.query(() => ({ status: "ok" as const })),
  me: protectedProcedure.query(({ ctx }) => ctx.staffUser),
});

export type AppRouter = typeof appRouter;

/** Server-side caller factory; used by integration tests and server contexts. */
export const createCaller = createCallerFactory(appRouter);
