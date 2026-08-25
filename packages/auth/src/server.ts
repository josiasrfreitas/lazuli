import type { AuthInstance } from "./auth.js";
import { resolveStaffIdentity, type StaffIdentity } from "./staff-access.js";

export type { StaffIdentity, StaffRole } from "./staff-access.js";

let authInstance: Promise<AuthInstance> | undefined;

async function getAuth(): Promise<AuthInstance> {
  authInstance ??= createAuthInstance();
  return authInstance;
}

async function createAuthInstance(): Promise<AuthInstance> {
  const [{ db }, { createAuth }] = await Promise.all([import("@lazuli/db"), import("./auth.js")]);

  return createAuth({ database: db });
}

export const auth: AuthInstance = {
  async handler(request) {
    const instance = await getAuth();
    return instance.handler(request);
  },
  async getSession({ headers }) {
    const instance = await getAuth();
    return instance.getSession({ headers });
  },
};

/**
 * The signed-in staff member behind a request, including the role a server
 * component needs to decide what it may render. Returns `null` when there is no
 * session or when the account no longer passes the staff-access check — a user
 * disabled mid-session loses access on the next request, not at expiry.
 *
 * The session itself only carries an email; identity is always reloaded from
 * `User` so the Better Auth adapter's id never leaks into domain decisions.
 */
export async function getStaffIdentity(input: { headers: Headers }): Promise<StaffIdentity | null> {
  const session = await auth.getSession({ headers: input.headers });

  if (session === null) {
    return null;
  }

  const { db } = await import("@lazuli/db");

  return resolveStaffIdentity(await db.user.findUnique({ where: { email: session.user.email } }));
}
