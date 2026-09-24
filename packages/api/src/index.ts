/**
 * tRPC routers, procedures, RBAC middleware, service orchestration (§2.1, §5).
 * The BFF boundary: all web writes go through these procedures.
 *
 * Note: must NOT import `@lazuli/worker-handlers` (Playwright/PDF/GCS/email) —
 * heavy work is enqueued via `@lazuli/job-contracts` only.
 */

import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "./root.js";

export const API_PACKAGE = "@lazuli/api" as const;

export { appRouter, createCaller } from "./root.js";
export type { AppRouter } from "./root.js";
export {
  adminProcedure,
  createCallerFactory,
  protectedProcedure,
  publicProcedure,
  router,
  staffProcedure,
  systemAdminProcedure,
  teacherProcedure,
} from "./trpc/init.js";
export { createTRPCContext } from "./trpc/context.js";
export type { Context, StaffUser } from "./trpc/context.js";
export { assertResourceScope, canAccess, ROLE_MATRIX, routerAccess } from "./trpc/rbac.js";
export type { RouterAccess, RouterName } from "./trpc/rbac.js";

/** Inference helper for procedure inputs, e.g. RouterInputs["someRouter"]["someProc"]. */
type RouterInputs = inferRouterInputs<AppRouter>;
/** Inference helper for procedure outputs. */
type RouterOutputs = inferRouterOutputs<AppRouter>;

export type { RouterInputs, RouterOutputs };
