const DEFAULT_SMTP_HOST = "localhost";
const DEFAULT_SMTP_PORT = 1025;

export type EmailEnvironment = {
  resendApiKey: string | undefined;
  emailFrom: string;
  smtpHost: string;
  smtpPort: number;
};

export function parseEmailEnvironment(
  source?: Record<string, string | undefined>,
): EmailEnvironment {
  const environment = source ?? process.env;

  return {
    resendApiKey: optionalEnvironment(environment.RESEND_API_KEY),
    emailFrom: requireEnvironment({ name: "EMAIL_FROM", value: environment.EMAIL_FROM }),
    smtpHost: optionalEnvironment(environment.SMTP_HOST) ?? DEFAULT_SMTP_HOST,
    smtpPort: parsePort(optionalEnvironment(environment.SMTP_PORT)),
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
