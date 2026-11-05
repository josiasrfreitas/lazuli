import {
  resolveStaffIdentity,
  staffRoleFromHeaders,
  type StaffIdentity,
  type StaffSession,
} from "@lazuli/auth";
import {
  createLocalReportGenerateQueue,
  type ReportGenerateQueue,
  type SessionsGenerateQueue,
} from "@lazuli/job-contracts";
import { createHatchetSessionsGenerateQueue } from "@lazuli/integrations/hatchet";
import { createServiceLogger, requestIdFromHeaders, safeError } from "@lazuli/logging";

const logger = createServiceLogger("web");

/** The Prisma client type, taken without a runtime import so `@lazuli/api` stays
 * importable (e.g. in unit tests) without requiring `DATABASE_URL`. The real
 * singleton is resolved lazily by {@link createTRPCContext}. */
type DbClient = (typeof import("@lazuli/db"))["db"];

/** Domain identity for an authenticated staff member. `id` is always `User.id`. */
export type StaffUser = StaffIdentity;

export type Context = {
  db: DbClient;
  now?: Date | undefined;
  reportGenerateQueue?: ReportGenerateQueue | undefined;
  sessionGenerationQueue?: SessionsGenerateQueue | undefined;
  staffUser: StaffUser | null;
  requestId?: string | undefined;
};

type CreateTRPCContextInput = {
  headers?: Headers;
  db?: DbClient;
  now?: Date | undefined;
  reportGenerateQueue?: ReportGenerateQueue | undefined;
  sessionGenerationQueue?: SessionsGenerateQueue | undefined;
  session: StaffSession | null;
  requestId?: string;
};

/**
 * Builds the tRPC request context. Dependency-injectable: tests pass a `db` and a
 * resolved `session` directly (no HTTP); the Next.js route passes the Better Auth
 * session it read from request headers. Domain identity is reloaded from `User` by
 * email — never taken from the Better Auth adapter id.
 *
 * No session means no staff user, in every environment. The local sign-in
 * shortcut this once carried was retired when the login screen shipped.
 */
export async function createTRPCContext(input: CreateTRPCContextInput): Promise<Context> {
  const requestId = requestIdForContext(input);
  const started = performance.now();
  try {
    const db = input.db ?? (await resolveDefaultDb());
    const session = input.session;
    const staffUser =
      session === null
        ? null
        : await resolveStaffUser({
            db,
            email: session.user.email,
            now: input.now ?? new Date(),
            role: staffRoleFromHeaders(input.headers),
          });

    const context: Context = {
      db,
      ...(input.now === undefined ? {} : { now: input.now }),
      reportGenerateQueue: input.reportGenerateQueue ?? createLocalReportGenerateQueue(),
      sessionGenerationQueue: input.sessionGenerationQueue ?? createHatchetSessionsGenerateQueue(),
      staffUser,
      requestId,
    };
    logger.info(
      {
        request_id: requestId,
        checkpoint: "trpc_context",
        duration_ms: Math.round(performance.now() - started),
        staff_user_id: staffUser?.id,
      },
      "tRPC context ready",
    );
    return context;
  } catch (error) {
    logger.error(
      {
        request_id: requestId,
        checkpoint: "trpc_context",
        duration_ms: Math.round(performance.now() - started),
        ...safeError(error),
      },
      "tRPC context failed",
    );
    throw error;
  }
}

function requestIdForContext(input: CreateTRPCContextInput): string | undefined {
  if (input.requestId) return input.requestId;
  return input.headers ? requestIdFromHeaders(input.headers) : undefined;
}

async function resolveDefaultDb(): Promise<DbClient> {
  const { db } = await import("@lazuli/db");
  return db;
}

async function resolveStaffUser(input: {
  role?: string | undefined;
  db: DbClient;
  email: string;
  now: Date;
}): Promise<StaffUser | null> {
  return resolveStaffIdentity(
    await input.db.user.findUnique({
      where: { email: input.email },
      include: { teacherProfile: { select: { departureDate: true, deletedAt: true } } },
    }),
    { now: input.now, requestedRole: input.role },
  );
}
