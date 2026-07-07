/**
 * External adapter interfaces plus light, shareable clients (§2.1).
 * The Playwright-heavy Portal implementation lives in worker-only code, not here.
 */

export const INTEGRATIONS_PACKAGE = "@lazuli/integrations" as const;

export type EmailSendInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type EmailSender = {
  send(input: EmailSendInput): Promise<void>;
};

export function createNoOpEmailSender(): EmailSender {
  return {
    send: () => Promise.resolve(),
  };
}

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
