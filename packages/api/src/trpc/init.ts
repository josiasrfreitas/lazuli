import { initTRPC, TRPCError } from "@trpc/server";
import type { StaffRole } from "@lazuli/auth";
import { z } from "@lazuli/validators";
import { createServiceLogger, safeError } from "@lazuli/logging";
import superjson from "superjson";

import type { Context } from "./context.js";
import { parseTrpcDevelopmentDelay, withDevelopmentTiming } from "./development-timing.js";
import { procedureOutcomeLabel } from "./procedure-labels.js";

const isDevelopment = globalThis.process.env.NODE_ENV === "development";
const logger = createServiceLogger("web");
const developmentDelay = isDevelopment
  ? parseTrpcDevelopmentDelay(globalThis.process.env.TRPC_DEV_DELAY_MS)
  : 0;

const trpc = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    message:
      error.code === "INTERNAL_SERVER_ERROR"
        ? "Não foi possível concluir a operação. Tente novamente."
        : shape.message,
    data: {
      ...shape.data,
      stack: undefined,
      zodError:
        error.code === "BAD_REQUEST" && error.cause instanceof z.ZodError
          ? error.cause.flatten()
          : null,
    },
  }),
});

export const router = trpc.router;
export const createCallerFactory = trpc.createCallerFactory;

const timingMiddleware = trpc.middleware(async ({ next, path, type, ctx }) => {
  const started = performance.now();
  try {
    const result = await withDevelopmentTiming({
      delayMs: developmentDelay,
      log: (message) => logger.debug({ procedure: path }, message.trim()),
      next,
      path,
    });
    const fields = {
      request_id: ctx.requestId,
      user_id: ctx.staffUser?.id,
      resource: path,
      operation: type === "query" ? "GET" : "POST",
      procedure: path,
      procedure_type: type,
      duration_ms: Math.round(performance.now() - started),
      staff_user_id: ctx.staffUser?.id,
    };
    if (result.ok) {
      const label = procedureOutcomeLabel(path);
      logger.info(
        {
          ...fields,
          status: "ok",
          process_step: label,
          ...(Array.isArray(result.data) ? { facts: { items: result.data.length } } : {}),
        },
        label,
      );
    } else if (result.error.code !== "INTERNAL_SERVER_ERROR")
      logger.warn(
        { ...fields, status: "error", error_code: result.error.code },
        `Failed: ${procedureOutcomeLabel(path)}`,
      );
    return result;
  } catch (error) {
    logger.error(
      {
        request_id: ctx.requestId,
        user_id: ctx.staffUser?.id,
        resource: path,
        operation: type === "query" ? "GET" : "POST",
        procedure: path,
        procedure_type: type,
        duration_ms: Math.round(performance.now() - started),
        ...safeError(error),
      },
      "Unexpected failure while processing operation",
    );
    throw error;
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

/** Ordinary administrative operations are available to ADMIN and SYSTEM_ADMIN. */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  assertRole(ctx.staffUser.role, ["ADMIN", "SYSTEM_ADMIN"]);
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

export const systemAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  assertRole(ctx.staffUser.role, ["SYSTEM_ADMIN"]);
  return next();
});

/**
 * Shared routers open to SYSTEM_ADMIN, ADMIN and TEACHER. Teacher access is narrowed to owned
 * resources in-resolver via `assertResourceScope`; both administrator roles have full access.
 */
export const staffProcedure = protectedProcedure.use(({ ctx, next }) => {
  assertRole(ctx.staffUser.role, ["SYSTEM_ADMIN", "ADMIN", "TEACHER"]);
  return next();
});
