import { parseEmailEnvironment, type EmailEnvironment } from "@lazuli/integrations";

export type AuthEnvironment = {
  appUrl: string;
  betterAuthSecret: string;
  googleOAuth?: { clientId: string; clientSecret: string } | undefined;
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
    googleOAuth: googleOAuthEnvironment(),
  };
}

function googleOAuthEnvironment(): AuthEnvironment["googleOAuth"] {
  return resolveGoogleOAuth({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    production: process.env.NODE_ENV === "production",
  });
}

export function resolveGoogleOAuth({
  clientId: rawClientId,
  clientSecret: rawClientSecret,
  production,
}: {
  clientId: string | undefined;
  clientSecret: string | undefined;
  production: boolean;
}): AuthEnvironment["googleOAuth"] {
  const clientId = optionalEnvironment(rawClientId);
  const clientSecret = optionalEnvironment(rawClientSecret);
  if (clientId !== undefined && clientSecret !== undefined) return { clientId, clientSecret };
  if (clientId !== undefined || clientSecret !== undefined) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together");
  }
  if (production) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required in production");
  }
  return undefined;
}

function requireEnvironment({ name, value }: { name: string; value: string | undefined }): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function optionalEnvironment(value: string | undefined): string | undefined {
  return value === undefined || value.length === 0 ? undefined : value;
}
