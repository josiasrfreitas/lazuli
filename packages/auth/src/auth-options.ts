import type { BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins/magic-link";

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const SESSION_DURATION_DAYS = 30;
const PASSWORD_RESET_MINUTES = 15;

export const THIRTY_DAY_SESSION_SECONDS =
  SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY * SESSION_DURATION_DAYS;

export type MagicLinkDelivery = {
  email: string;
  url: string;
  token: string;
};

export type MagicLinkSender = (delivery: MagicLinkDelivery) => Promise<void>;
export type PasswordResetSender = (delivery: { email: string; url: string }) => Promise<void>;

export type AuthOptionsInput = {
  baseUrl: string;
  secret: string;
  database: Parameters<typeof prismaAdapter>[0];
  sendMagicLink: MagicLinkSender;
  sendResetPassword: PasswordResetSender;
};

export function createAuthOptions(input: AuthOptionsInput): BetterAuthOptions {
  return {
    appName: "Lazuli",
    baseURL: input.baseUrl,
    secret: input.secret,
    database: prismaAdapter(input.database, { provider: "postgresql" }),
    rateLimit: { storage: "database" },
    advanced: {
      defaultCookieAttributes: {
        path: "/",
        sameSite: "lax",
      },
      database: {
        generateId: "uuid",
      },
    },
    session: {
      expiresIn: THIRTY_DAY_SESSION_SECONDS,
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: PASSWORD_RESET_MINUTES * SECONDS_PER_MINUTE,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await input.sendResetPassword({ email: user.email, url });
      },
    },
    plugins: [
      magicLink({
        disableSignUp: true,
        sendMagicLink: input.sendMagicLink,
      }),
    ],
  };
}
