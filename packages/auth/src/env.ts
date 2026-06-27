export type AuthEnvironment = {
  appUrl: string;
  betterAuthSecret: string;
  googleClientId: string;
  googleClientSecret: string;
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
    googleClientId: requireEnvironment({
      name: "GOOGLE_CLIENT_ID",
      value: process.env.GOOGLE_CLIENT_ID,
    }),
    googleClientSecret: requireEnvironment({
      name: "GOOGLE_CLIENT_SECRET",
      value: process.env.GOOGLE_CLIENT_SECRET,
    }),
    resendApiKey: optionalEnvironment(process.env.RESEND_API_KEY),
    emailFrom: requireEnvironment({ name: "EMAIL_FROM", value: process.env.EMAIL_FROM }),
    smtpHost: optionalEnvironment(process.env.SMTP_HOST) ?? "localhost",
    smtpPort: parsePort(optionalEnvironment(process.env.SMTP_PORT)),
  };
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
