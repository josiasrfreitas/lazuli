import { TRPCError } from "@trpc/server";

import type { StaffRole } from "@lazuli/auth";

import type { StaffUser } from "./context.js";

/** tRPC routers governed by the §5.2 RBAC matrix (mirrors §5.1 router organization). */
export type RouterName =
  | "users"
  | "students"
  | "catalog"
  | "classes"
  | "calendar"
  | "enrollment"
  | "attendance"
  | "portal"
  | "finance"
  | "reports"
  | "dashboard";

/**
 * Access a role holds over a router (§5.2):
 * - `full`   — reachable with no scope restriction.
 * - `scoped` — reachable but restricted: to resources the teacher owns (enforced
 *   in-resolver by {@link assertResourceScope}) or to the role's own context, e.g. the
 *   teacher home and current-stage reads. Finer read/write and same-day rules live in
 *   the procedures, not here.
 * - `none`   — not reachable; procedures reject with FORBIDDEN (HTTP 403).
 */
export type RouterAccess = "full" | "scoped" | "none";

/** A role with no access to any router (the deferred SECRETARY/FINANCE default). */
function deniedAll(): Record<RouterName, RouterAccess> {
  return {
    users: "none",
    students: "none",
    catalog: "none",
    classes: "none",
    calendar: "none",
    enrollment: "none",
    attendance: "none",
    portal: "none",
    finance: "none",
    reports: "none",
    dashboard: "none",
  };
}

/**
 * The §5.2 RBAC matrix as data — the single source of truth consumed by the
 * role-based menu (GRE-16) and asserted by tests. It encodes router-level
 * reachability only; finer rules (e.g. catalog writes being seed/dev-only per §5.2)
 * live in the procedures, not the matrix. SYSTEM_ADMIN, ADMIN and TEACHER are enabled;
 * SECRETARY and FINANCE exist in the enum but hold `none` everywhere until
 * the expense/bank modules enable them.
 */
export const ROLE_MATRIX: Record<StaffRole, Record<RouterName, RouterAccess>> = {
  SYSTEM_ADMIN: {
    users: "full",
    students: "full",
    catalog: "full",
    classes: "full",
    calendar: "full",
    enrollment: "full",
    attendance: "full",
    portal: "full",
    finance: "full",
    reports: "full",
    dashboard: "full",
  },
  ADMIN: {
    users: "full",
    students: "full",
    catalog: "full",
    classes: "full",
    calendar: "full",
    enrollment: "full",
    attendance: "full",
    portal: "full",
    finance: "full",
    reports: "full",
    dashboard: "full",
  },
  TEACHER: {
    users: "none",
    students: "scoped",
    catalog: "scoped",
    classes: "scoped",
    calendar: "scoped",
    enrollment: "scoped",
    attendance: "scoped",
    portal: "none",
    finance: "none",
    reports: "scoped",
    dashboard: "scoped",
  },
  SECRETARY: deniedAll(),
  FINANCE: deniedAll(),
};

/** Flattened `"role:router" -> access` view of {@link ROLE_MATRIX} for keyed lookup. */
const ACCESS_LOOKUP = new Map<string, RouterAccess>(
  Object.entries(ROLE_MATRIX).flatMap(([role, byRouter]) =>
    Object.entries(byRouter).map(([router, access]) => [`${role}:${router}`, access] as const),
  ),
);

/** Access `role` holds over `router` per the §5.2 matrix; unknown pairs deny by default. */
export function routerAccess(role: StaffRole, router: RouterName): RouterAccess {
  return ACCESS_LOOKUP.get(`${role}:${router}`) ?? "none";
}

/** Whether `role` may reach `router` at all (`full` or `scoped`); consumed by GRE-16's role-filtered menu. */
export function canAccess(role: StaffRole, router: RouterName): boolean {
  return routerAccess(role, router) !== "none";
}

/**
 * Teacher resource-scope guard (§5.2). Call inside a shared-router resolver after
 * loading the owning resource. ADMIN has full access; a TEACHER may only touch
 * resources they own (`Class.teacherId === ctx.staffUser.id`). Every other case —
 * including the deferred SECRETARY/FINANCE roles — rejects with FORBIDDEN (HTTP 403).
 */
export function assertResourceScope(staffUser: StaffUser, resource: { teacherId: string }): void {
  if (staffUser.role === "ADMIN" || staffUser.role === "SYSTEM_ADMIN") {
    return;
  }
  if (staffUser.role === "TEACHER" && resource.teacherId === staffUser.id) {
    return;
  }
  throw new TRPCError({ code: "FORBIDDEN" });
}
