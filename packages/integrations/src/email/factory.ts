import type { EmailEnvironment } from "./env.js";
import { parseEmailEnvironment } from "./env.js";
import { createResendEmailSender } from "./resend-sender.js";
import type { EmailSender } from "./sender.js";
import { createSmtpEmailSender } from "./smtp-sender.js";

export type EmailTransportSelection =
  | { kind: "resend"; apiKey: string; from: string }
  | { kind: "smtp"; host: string; port: number; from: string };

/** D-0007: a Resend API key selects Resend; otherwise mail routes to SMTP (Mailpit locally). */
export function selectEmailTransport(environment: EmailEnvironment): EmailTransportSelection {
  if (environment.resendApiKey !== undefined) {
    return { kind: "resend", apiKey: environment.resendApiKey, from: environment.emailFrom };
  }

  return {
    kind: "smtp",
    host: environment.smtpHost,
    port: environment.smtpPort,
    from: environment.emailFrom,
  };
}

/** Defaults to `process.env` (resolved inside the validated env module). */
export function createEmailSenderFromEnv(source?: Record<string, string | undefined>): EmailSender {
  const selection = selectEmailTransport(parseEmailEnvironment(source));

  return selection.kind === "resend"
    ? createResendEmailSender(selection)
    : createSmtpEmailSender(selection);
}
