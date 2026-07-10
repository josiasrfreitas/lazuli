/**
 * Artifact storage seam (D-0007): reports/PDF/CSV bytes go to GCS in prod and
 * fake-gcs-server locally. Rows store bucket + object key, never public URLs
 * (TECHNICAL_SPEC §4.8); downloads use signed URLs generated on demand.
 */

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
