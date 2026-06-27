import type { BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins/magic-link";

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const SESSION_DURATION_DAYS = 30;

export const THIRTY_DAY_SESSION_SECONDS =
  SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY * SESSION_DURATION_DAYS;

export type MagicLinkDelivery = {
  email: string;
  url: string;
  token: string;
};

export type MagicLinkSender = (delivery: MagicLinkDelivery) => Promise<void>;

export type AuthOptionsInput = {
  baseUrl: string;
  secret: string;
  googleClientId: string;
  googleClientSecret: string;
  database: Parameters<typeof prismaAdapter>[0];
  sendMagicLink: MagicLinkSender;
};

export function createAuthOptions(input: AuthOptionsInput): BetterAuthOptions {
  return {
    appName: "Lazuli",
    baseURL: input.baseUrl,
    secret: input.secret,
    database: prismaAdapter(input.database, { provider: "postgresql" }),
    advanced: {
      database: {
        generateId: "uuid",
      },
    },
    session: {
      expiresIn: THIRTY_DAY_SESSION_SECONDS,
    },
    socialProviders: {
      google: {
        clientId: input.googleClientId,
        clientSecret: input.googleClientSecret,
        disableSignUp: true,
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
