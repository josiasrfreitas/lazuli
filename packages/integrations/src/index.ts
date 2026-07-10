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

export type ArtifactPutInput = {
  key: string;
  contentType: string;
  body: Uint8Array;
};

export type ArtifactPutResult = {
  bucket: string;
  key: string;
};

export class ArtifactStorageNotConfiguredError extends Error {
  constructor() {
    super("NOT_CONFIGURED");
    this.name = "ArtifactStorageNotConfiguredError";
  }
}

export type ArtifactStorage = {
  put(input: ArtifactPutInput): Promise<ArtifactPutResult>;
  getSignedUrl(key: string): Promise<string>;
};

export function createNoOpArtifactStorage(): ArtifactStorage {
  return {
    put: (input) =>
      Promise.resolve({
        bucket: "local-stub",
        key: input.key,
      }),
    getSignedUrl: () => Promise.reject(new ArtifactStorageNotConfiguredError()),
  };
}
