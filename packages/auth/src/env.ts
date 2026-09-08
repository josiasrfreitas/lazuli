import { parseEmailEnvironment, type EmailEnvironment } from "@lazuli/integrations";

export type AuthEnvironment = EmailEnvironment & {
  appUrl: string;
  betterAuthSecret: string;
  googleClientId: string;
  googleClientSecret: string;
};

export function getAuthEnvironment(): AuthEnvironment {
  return {
    ...parseEmailEnvironment(process.env),
    appUrl: requireEnvironment({ name: "APP_URL", value: process.env.APP_URL }),
    betterAuthSecret: requireEnvironment({
      name: "BETTER_AUTH_SECRET",
      value: process.env.BETTER_AUTH_SECRET,
    }),
    googleClientId: requireEnvironment({
      name: "GOOGLE_CLIENT_ID",
      value: process.env.GOOGLE_CLIENT_ID,
    }),
    googleClientSecret: requireEnvironment({
      name: "GOOGLE_CLIENT_SECRET",
      value: process.env.GOOGLE_CLIENT_SECRET,
    }),
  };
}

function requireEnvironment({ name, value }: { name: string; value: string | undefined }): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required`);
  }

  return value;
}
