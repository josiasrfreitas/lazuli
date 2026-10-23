import { parseEmailEnvironment, type EmailEnvironment } from "@lazuli/integrations";

export type AuthEnvironment = {
  appUrl: string;
  betterAuthSecret: string;
} & EmailEnvironment;

export function getAuthEnvironment(): AuthEnvironment {
  const email = parseEmailEnvironment();
  return {
    ...email,
    appUrl: requireEnvironment({ name: "APP_URL", value: process.env.APP_URL }),
    betterAuthSecret: requireEnvironment({
      name: "BETTER_AUTH_SECRET",
      value: process.env.BETTER_AUTH_SECRET,
    }),
  };
}

function requireEnvironment({ name, value }: { name: string; value: string | undefined }): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required`);
  }

  return value;
}
