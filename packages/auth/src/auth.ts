import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";

import type { createDbClient } from "@lazuli/db";

import {
  createAuthOptions,
  type AuthOptionsInput,
  type MagicLinkSender,
  type PasswordResetSender,
} from "./auth-options.js";
import { createMagicLinkSender, createPasswordResetSender } from "./email.js";
import { getAuthEnvironment } from "./env.js";
import type { AuthEnvironment } from "./env.js";
import {
  evaluateStaffAccess,
  STAFF_ACCESS_DENIED_CODE,
  type StaffAccessUser,
} from "./staff-access.js";

const MAGIC_LINK_VERIFY_PATH = "/magic-link/verify";

type StaffDatabase = AuthOptionsInput["database"] & ReturnType<typeof createDbClient>;

export type CreateAuthInput = {
  environment?: AuthEnvironment;
  database: StaffDatabase;
  sendMagicLink?: MagicLinkSender;
  sendResetPassword?: PasswordResetSender;
};

/** Narrow session shape consumed downstream; domain identity is reloaded by email. */
export type StaffSession = { user: { email: string } };

export type AuthInstance = {
  handler: (request: Request) => Promise<Response>;
  getSession: (input: { headers: Headers }) => Promise<StaffSession | null>;
};

export function createAuth(input: CreateAuthInput): AuthInstance {
  const environment = input.environment ?? getAuthEnvironment();
  const database = input.database;
  const sendMagicLink = input.sendMagicLink ?? createMagicLinkSender(environment);
  const sendResetPassword = input.sendResetPassword ?? createPasswordResetSender(environment);

  const instance = betterAuth({
    ...createAuthOptions({
      baseUrl: environment.appUrl,
      secret: environment.betterAuthSecret,
      database,
      sendResetPassword: async (delivery) => {
        const user = await database.user.findUnique({
          where: { email: delivery.email },
          include: { teacherProfile: { select: { departureDate: true, deletedAt: true } } },
        });
        // Keep the public response identical for unknown and ineligible staff.
        if (evaluateStaffAccess(user).allowed) await sendResetPassword(delivery);
      },
      sendMagicLink: async (delivery) => {
        const user = await database.user.findUnique({
          where: { email: delivery.email },
          include: { teacherProfile: { select: { departureDate: true, deletedAt: true } } },
        });
        // The request response must not reveal whether an eligible account exists.
        if (evaluateStaffAccess(user).allowed) await sendMagicLink(delivery);
      },
    }),
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const user = await database.user.findUnique({
              where: { id: session.userId },
              include: { teacherProfile: { select: { departureDate: true, deletedAt: true } } },
            });
            assertStaffAccess(user);
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/reset-password") return;
        const body = ctx.body as { token?: string } | undefined;
        const query = ctx.query as { token?: string } | undefined;
        const token = body?.token || query?.token;
        if (!token) return;
        const verification = await database.verification.findFirst({
          where: { identifier: `reset-password:${token}`, expiresAt: { gt: new Date() } },
          select: { value: true },
        });
        if (!verification) return;
        const user = await database.user.findUnique({
          where: { id: verification.value },
          include: { teacherProfile: { select: { departureDate: true, deletedAt: true } } },
        });
        if (!evaluateStaffAccess(user).allowed) {
          await database.verification.deleteMany({ where: { identifier: `reset-password:${token}` } });
          throw new APIError("BAD_REQUEST", { code: "INVALID_TOKEN", message: "Invalid token" });
        }
      }),
      after: redirectDeniedMagicLinkVerification,
    },
  });

  return {
    handler: (request) => instance.handler(request),
    getSession: async ({ headers }) => {
      const result = await instance.api.getSession({ headers });
      return result === null ? null : { user: { email: result.user.email } };
    },
  };
}

function assertStaffAccess(user: StaffAccessUser | null): void {
  const result = evaluateStaffAccess(user);

  if (!result.allowed) {
    /* The code lets the login screen distinguish denied access from an expired link. */
    throw new APIError("UNAUTHORIZED", {
      code: STAFF_ACCESS_DENIED_CODE,
      message: result.message,
    });
  }
}

/**
 * The magic-link verify route is a browser navigation, but a staff-access
 * denial raised while creating the session surfaces as a JSON `APIError` —
 * Better Auth only turns its own failures (invalid token, signup disabled)
 * into redirects there. This hook gives our denial the same treatment, so the
 * person lands back on the login screen instead of on raw JSON.
 */
const HTTP_FOUND = 302;

const redirectDeniedMagicLinkVerification = createAuthMiddleware((ctx) => {
  const denied = ctx.path === MAGIC_LINK_VERIFY_PATH && isStaffAccessDenied(ctx.context.returned);

  // Resolving with no value leaves the endpoint's own response untouched.
  return Promise.resolve(denied ? deniedRedirectResponse(ctx) : undefined);
});

type DeniedRedirectContext = {
  query?: Partial<Record<"callbackURL" | "errorCallbackURL", string>> | undefined;
  context: { baseURL: string };
};

/**
 * A real `Response`, not `ctx.redirect`: when an after-hook replaces an
 * endpoint's error, the dispatcher keeps the original error's status, so a
 * thrown redirect would leave with a Location header on a 401. A `Response`
 * passes through untouched.
 */
function deniedRedirectResponse(ctx: DeniedRedirectContext): Response {
  const query = ctx.query ?? {};
  // Resolve the target exactly as the plugin's own redirectWithError does.
  const callbackUrl = new URL(
    query.callbackURL === undefined ? "/" : decodeURIComponent(query.callbackURL),
    ctx.context.baseURL,
  ).toString();
  const errorUrl = new URL(
    query.errorCallbackURL === undefined ? callbackUrl : decodeURIComponent(query.errorCallbackURL),
    ctx.context.baseURL,
  );
  errorUrl.searchParams.set("error", STAFF_ACCESS_DENIED_CODE);

  return new Response(null, { headers: { location: errorUrl.toString() }, status: HTTP_FOUND });
}

function isStaffAccessDenied(returned: unknown): boolean {
  return returned instanceof APIError && returned.body?.code === STAFF_ACCESS_DENIED_CODE;
}
