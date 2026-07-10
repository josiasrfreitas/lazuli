import { Storage } from "@google-cloud/storage";

import type { ArtifactStorage } from "./storage.js";

const SIGNED_URL_TTL_MINUTES = 15;
const MILLISECONDS_PER_MINUTE = 60_000;

export type GcsArtifactStorageConfig = {
  projectId: string;
  bucket: string;
  /**
   * fake-gcs-server base URL (e.g. `http://localhost:4443`). When set the
   * client talks to the emulator without auth; when unset it follows the
   * real GCS Application Default Credentials path.
   */
  emulatorHost?: string;
};

export function createGcsArtifactStorage(config: GcsArtifactStorageConfig): ArtifactStorage {
  const storage = createStorageClient(config);
  const bucket = storage.bucket(config.bucket);

  return {
    put: async (input) => {
      await bucket.file(input.key).save(Buffer.from(input.body), {
        contentType: input.contentType,
        resumable: false,
      });

      return { bucket: config.bucket, key: input.key };
    },
    getSignedUrl: async (key) => {
      if (config.emulatorHost !== undefined) {
        return emulatorMediaUrl({ config, key });
      }

      const [url] = await bucket.file(key).getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + SIGNED_URL_TTL_MINUTES * MILLISECONDS_PER_MINUTE,
      });

      return url;
    },
  };
}

function createStorageClient(config: GcsArtifactStorageConfig): Storage {
  if (config.emulatorHost !== undefined) {
    // `useAuthWithCustomEndpoint` defaults to false, so the emulator path is anonymous.
    return new Storage({ projectId: config.projectId, apiEndpoint: config.emulatorHost });
  }

  return new Storage({ projectId: config.projectId });
}

/**
 * fake-gcs-server has no signing keys, so emulator "signed URLs" are the plain
 * media-download URL — good enough for local download flows and tests.
 */
function emulatorMediaUrl(input: { config: GcsArtifactStorageConfig; key: string }): string {
  const base = input.config.emulatorHost?.replace(/\/$/, "") ?? "";
  const object = encodeURIComponent(input.key);

  return `${base}/storage/v1/b/${input.config.bucket}/o/${object}?alt=media`;
}
