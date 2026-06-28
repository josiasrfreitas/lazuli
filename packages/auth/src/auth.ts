import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";

import type { createDbClient } from "@lazuli/db";

import { createAuthOptions, type AuthOptionsInput, type MagicLinkSender } from "./auth-options.js";
import { createMagicLinkSender } from "./email.js";
import { getAuthEnvironment } from "./env.js";
import type { AuthEnvironment } from "./env.js";
import { evaluateStaffAccess, type StaffAccessUser } from "./staff-access.js";

type StaffDatabase = AuthOptionsInput["database"] & ReturnType<typeof createDbClient>;

export type CreateAuthInput = {
  environment?: AuthEnvironment;
  database: StaffDatabase;
  sendMagicLink?: MagicLinkSender;
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

  const instance = betterAuth({
    ...createAuthOptions({
      baseUrl: environment.appUrl,
      secret: environment.betterAuthSecret,
      googleClientId: environment.googleClientId,
      googleClientSecret: environment.googleClientSecret,
      database,
      sendMagicLink: async (delivery) => {
        await assertStaffCanAuthenticate(database, delivery.email);
        await sendMagicLink(delivery);
      },
    }),
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const user = await database.user.findUnique({ where: { id: session.userId } });
            assertStaffAccess(user);
          },
        },
      },
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

async function assertStaffCanAuthenticate(database: StaffDatabase, email: string): Promise<void> {
  const user = await database.user.findUnique({ where: { email } });
  assertStaffAccess(user);
}

function assertStaffAccess(user: StaffAccessUser | null): void {
  const result = evaluateStaffAccess(user);

  if (!result.allowed) {
    throw new APIError("UNAUTHORIZED", { message: result.message });
  }
}
