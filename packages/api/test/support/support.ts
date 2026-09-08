import assert from "node:assert/strict";

import { TRPCError } from "@trpc/server";

import { routerAccess } from "@lazuli/api";
import type { Context, RouterName, StaffUser } from "@lazuli/api";

const FORBIDDEN = "FORBIDDEN";
const UNAUTHORIZED = "UNAUTHORIZED";
const PASSED = "PASSED";

/** The eleven routers governed by the §5.2 RBAC matrix (§5.1 router organization). */
export const ALL_ROUTERS: readonly RouterName[] = [
  "users",
  "students",
  "catalog",
  "classes",
  "calendar",
  "enrollment",
  "attendance",
  "portal",
  "finance",
  "reports",
  "dashboard",
];

export const ADMIN_FIXTURE: StaffUser = {
  id: "00000000-0000-0000-0000-0000000000ad",
  name: "Admin de Teste",
  email: "admin@example.com",
  role: "ADMIN",
  isEnabled: true,
};

export const TEACHER_FIXTURE: StaffUser = {
  id: "00000000-0000-0000-0000-0000000000ed",
  name: "Professora de Teste",
  email: "teacher@example.com",
  role: "TEACHER",
  isEnabled: true,
};

/** RBAC gating never touches the database, so a typed empty stand-in is enough. */
export function contextFor(staffUser: StaffUser | null): Context {
  return { db: {} as Context["db"], staffUser };
}

/** Invokes one representative procedure of a router as the given caller. */
export type InvokeAs = (staffUser: StaffUser | null) => Promise<unknown>;

/**
 * Drift guard between a mounted router and the §5.2 matrix. Probes `invoke` — one
 * representative procedure of `router` — as ADMIN, TEACHER, and an anonymous caller and
 * asserts the role gate matches `routerAccess`: ADMIN always reaches the resolver (admin
 * is full on every router), TEACHER is FORBIDDEN exactly when the matrix says `none`, and
 * an anonymous caller is always UNAUTHORIZED. Router-level only — intra-router admin-only
 * procedures and teacher resource scope are asserted by the router's own tests. Pick a
 * probe that reflects the router's primary gate (not a teacher-only endpoint).
 */
export async function assertRouterGating(input: {
  router: RouterName;
  invoke: InvokeAs;
}): Promise<void> {
  await assertReachesResolver(input.invoke, ADMIN_FIXTURE);
  await (routerAccess("TEACHER", input.router) === "none"
    ? assertForbidden(input.invoke, TEACHER_FIXTURE)
    : assertReachesResolver(input.invoke, TEACHER_FIXTURE));
  await assertUnauthorized(input.invoke);
}

async function assertReachesResolver(invoke: InvokeAs, user: StaffUser): Promise<void> {
  const outcome = await gateOutcome(invoke, user);
  assert.notEqual(outcome, FORBIDDEN, `${user.role} was blocked but the matrix grants access`);
  assert.notEqual(outcome, UNAUTHORIZED, `${user.role} was rejected as unauthenticated`);
}

async function assertForbidden(invoke: InvokeAs, user: StaffUser): Promise<void> {
  const outcome = await gateOutcome(invoke, user);
  assert.equal(
    outcome,
    FORBIDDEN,
    `${user.role} reached a router the matrix denies (expected FORBIDDEN)`,
  );
}

async function assertUnauthorized(invoke: InvokeAs): Promise<void> {
  const outcome = await gateOutcome(invoke, null);
  assert.equal(outcome, UNAUTHORIZED, "anonymous caller was not rejected with UNAUTHORIZED");
}

/**
 * Runs `invoke` and reports the gate-relevant outcome: the TRPCError code when the role
 * gate rejects, or `PASSED` when the resolver ran (or failed for a non-gate reason). The
 * role gate runs before input parsing, so invalid input surfaces as a non-gate error
 * here, never a false FORBIDDEN.
 */
async function gateOutcome(invoke: InvokeAs, user: StaffUser | null): Promise<string> {
  try {
    await invoke(user);
    return PASSED;
  } catch (error) {
    if (error instanceof TRPCError && (error.code === FORBIDDEN || error.code === UNAUTHORIZED)) {
      return error.code;
    }
    return PASSED;
  }
}
