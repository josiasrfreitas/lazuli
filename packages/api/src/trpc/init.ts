import { initTRPC, TRPCError } from "@trpc/server";
import type { StaffRole } from "@lazuli/auth";
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
 * narrows it to non-null. Base for the role gates below.
 */
const enforceStaffAuth = trpc.middleware(({ ctx, next }) => {
  if (ctx.staffUser === null) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({ ctx: { staffUser: ctx.staffUser } });
});

/** Any authenticated, enabled staff member; no role restriction. */
export const protectedProcedure = trpc.procedure.use(timingMiddleware).use(enforceStaffAuth);

/**
 * Role gate (GRE-17, §5.2). Rejects with FORBIDDEN (HTTP 403) unless `role` is one of
 * `allowed`. The role gates below chain onto `protectedProcedure`, so `ctx.staffUser` is
 * already non-null; only the role itself is checked here.
 */
function assertRole(role: StaffRole, allowed: readonly StaffRole[]): void {
  if (!allowed.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

/** ADMIN-only routers/procedures: `users`, `portal`, `finance`, admin dashboard (§5.2). */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  assertRole(ctx.staffUser.role, ["ADMIN"]);
  return next();
});

/**
 * TEACHER-only procedures, e.g. the teacher home (§5.2). ADMIN is intentionally denied
 * here: it reaches the same router area through its own procedure (e.g. the admin
 * dashboard), so the §5.2 matrix still grants ADMIN `full` router access.
 */
export const teacherProcedure = protectedProcedure.use(({ ctx, next }) => {
  assertRole(ctx.staffUser.role, ["TEACHER"]);
  return next();
});

/**
 * Shared routers open to ADMIN and TEACHER (§5.2). Teacher access is narrowed to owned
 * resources in-resolver via `assertResourceScope`; ADMIN has full access.
 */
export const staffProcedure = protectedProcedure.use(({ ctx, next }) => {
  assertRole(ctx.staffUser.role, ["ADMIN", "TEACHER"]);
  return next();
});
