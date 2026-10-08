/**
 * External adapter interfaces plus light, shareable clients (§2.1).
 * The Playwright-heavy Portal implementation lives in worker-only code, not here.
 */

export const INTEGRATIONS_PACKAGE = "@lazuli/integrations" as const;

export type { EmailBody, EmailSender, EmailSendInput } from "./email/sender.js";
export { createNoOpEmailSender, EmailBodyMissingError, requireEmailBody } from "./email/sender.js";
export type { EmailEnvironment } from "./email/env.js";
export { parseEmailEnvironment } from "./email/env.js";
export type { ResendEmailSenderConfig } from "./email/resend-sender.js";
export { createResendEmailSender, ResendSendError } from "./email/resend-sender.js";
export type { SmtpEmailSenderConfig } from "./email/smtp-sender.js";
export { createSmtpEmailSender } from "./email/smtp-sender.js";
export type { EmailTransportSelection } from "./email/factory.js";
export { createEmailSenderFromEnv, selectEmailTransport } from "./email/factory.js";
