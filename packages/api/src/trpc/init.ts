import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "@lazuli/validators";
import superjson from "superjson";

import type { Context } from "./context.js";

const DEVELOPMENT_DELAY_MINIMUM_MILLISECONDS = 100;
const DEVELOPMENT_DELAY_RANGE_MILLISECONDS = 400;
const isDevelopment = globalThis.process.env.NODE_ENV === "development";

const trpc = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof z.ZodError ? error.cause.flatten() : null,
    },
  }),
});

export const router = trpc.router;
export const createCallerFactory = trpc.createCallerFactory;

const timingMiddleware = trpc.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (isDevelopment) {
    const waitMs =
      Math.floor(Math.random() * DEVELOPMENT_DELAY_RANGE_MILLISECONDS) +
      DEVELOPMENT_DELAY_MINIMUM_MILLISECONDS;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  try {
    return await next();
  } finally {
    const end = Date.now();
    process.stdout.write(`[TRPC] ${path} took ${end - start}ms\n`);
  }
});

/** Open to anyone; no session required. */
export const publicProcedure = trpc.procedure.use(timingMiddleware);

/**
 * Authenticated + enabled-staff gate. Rejects unless `ctx.staffUser` resolved, then
 * narrows it to non-null.
 *
 * RBAC SEAM (GRE-17): role-gating (`adminProcedure`/`teacherProcedure`) and the teacher
 * resource-scope guard (`Class.teacherId === ctx.staffUser.id`) chain onto
 * `protectedProcedure` here. This issue intentionally leaves the seam empty.
 */
const enforceStaffAuth = trpc.middleware(({ ctx, next }) => {
  if (ctx.staffUser === null) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({ ctx: { staffUser: ctx.staffUser } });
});

export const protectedProcedure = trpc.procedure
  .use(timingMiddleware)
  .use(enforceStaffAuth);
