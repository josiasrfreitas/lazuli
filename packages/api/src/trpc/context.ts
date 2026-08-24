import { evaluateStaffAccess, type StaffRole, type StaffSession } from "@lazuli/auth";
import {
  createLocalSessionsGenerateQueue,
  createLocalReportGenerateQueue,
  type ReportGenerateQueue,
  type SessionsGenerateQueue,
} from "@lazuli/job-contracts";

import { readDevAuthEmail } from "./dev-auth-env.js";

/** The Prisma client type, taken without a runtime import so `@lazuli/api` stays
 * importable (e.g. in unit tests) without requiring `DATABASE_URL`. The real
 * singleton is resolved lazily by {@link createTRPCContext}. */
type DbClient = (typeof import("@lazuli/db"))["db"];

/** Domain identity for an authenticated staff member. `id` is always `User.id`. */
export type StaffUser = {
  id: string;
  email: string;
  role: StaffRole;
  isEnabled: boolean;
};

export type Context = {
  db: DbClient;
  now?: Date;
  reportGenerateQueue?: ReportGenerateQueue;
  sessionGenerationQueue?: SessionsGenerateQueue;
  staffUser: StaffUser | null;
};

type CreateTRPCContextInput = {
  db?: DbClient;
  now?: Date;
  reportGenerateQueue?: ReportGenerateQueue;
  sessionGenerationQueue?: SessionsGenerateQueue;
  session: StaffSession | null;
  /**
   * Overrides the development sign-in shortcut (see dev-auth-env.ts). Omit to read
   * the environment; pass `null` to assert production behaviour in tests.
   */
  devAuthEmail?: string | null;
};

/**
 * Builds the tRPC request context. Dependency-injectable: tests pass a `db` and a
 * resolved `session` directly (no HTTP); the Next.js route passes the Better Auth
 * session it read from request headers. Domain identity is reloaded from `User` by
 * email — never taken from the Better Auth adapter id.
 */
export async function createTRPCContext(input: CreateTRPCContextInput): Promise<Context> {
  const db = input.db ?? (await resolveDefaultDb());
  const staffUser = await resolveContextStaffUser({ db, input });

  return {
    db,
    ...(input.now === undefined ? {} : { now: input.now }),
    reportGenerateQueue: input.reportGenerateQueue ?? createLocalReportGenerateQueue(),
    sessionGenerationQueue: input.sessionGenerationQueue ?? createLocalSessionsGenerateQueue(),
    staffUser,
  };
}

/** Session first; the dev shortcut only fills in when there is no session at all. */
async function resolveContextStaffUser(input: {
  db: DbClient;
  input: CreateTRPCContextInput;
}): Promise<StaffUser | null> {
  const session = input.input.session;

  if (session !== null) {
    return resolveStaffUser({ db: input.db, email: session.user.email });
  }

  const devAuthEmail =
    input.input.devAuthEmail === undefined ? readDevAuthEmail() : input.input.devAuthEmail;

  if (devAuthEmail === null) {
    return null;
  }

  return resolveStaffUser({ db: input.db, email: devAuthEmail });
}

async function resolveDefaultDb(): Promise<DbClient> {
  const { db } = await import("@lazuli/db");
  return db;
}

async function resolveStaffUser(input: { db: DbClient; email: string }): Promise<StaffUser | null> {
  const user = await input.db.user.findUnique({ where: { email: input.email } });

  if (user === null || !evaluateStaffAccess(user).allowed) {
    return null;
  }

  return { id: user.id, email: user.email, role: user.role, isEnabled: user.isEnabled };
}
