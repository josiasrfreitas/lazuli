export type AuthEnvironment = {
  appUrl: string;
  betterAuthSecret: string;
  googleOAuth?: { clientId: string; clientSecret: string } | undefined;
  resendApiKey: string | undefined;
  emailFrom: string;
  smtpHost: string;
  smtpPort: number;
};

const DEFAULT_SMTP_PORT = 1025;

export function getAuthEnvironment(): AuthEnvironment {
  return {
    appUrl: requireEnvironment({ name: "APP_URL", value: process.env.APP_URL }),
    betterAuthSecret: requireEnvironment({
      name: "BETTER_AUTH_SECRET",
      value: process.env.BETTER_AUTH_SECRET,
    }),
    googleOAuth: googleOAuthEnvironment(),
    resendApiKey: optionalEnvironment(process.env.RESEND_API_KEY),
    emailFrom: requireEnvironment({ name: "EMAIL_FROM", value: process.env.EMAIL_FROM }),
    smtpHost: optionalEnvironment(process.env.SMTP_HOST) ?? "localhost",
    smtpPort: parsePort(optionalEnvironment(process.env.SMTP_PORT)),
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

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_SMTP_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("SMTP_PORT must be a positive integer");
  }

  return port;
}
