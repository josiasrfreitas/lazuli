import type { StorageEnvironment } from "./env.js";
import { parseStorageEnvironment } from "./env.js";
import { createGcsArtifactStorage } from "./gcs-storage.js";
import type { ArtifactStorage } from "./storage.js";
import { createNoOpArtifactStorage } from "./storage.js";

export type ArtifactStorageSelection =
  | { kind: "gcs"; projectId: string; bucket: string; emulatorHost: string | undefined }
  | { kind: "none" };

/**
 * D-0007: project + bucket select GCS (emulator when `STORAGE_EMULATOR_HOST`
 * is set); missing/empty values fall back to the no-op storage so local dev
 * without GCS config keeps working.
 */
export function selectArtifactStorage(environment: StorageEnvironment): ArtifactStorageSelection {
  if (environment.gcsProjectId === undefined || environment.gcsArtifactsBucket === undefined) {
    return { kind: "none" };
  }

  return {
    kind: "gcs",
    projectId: environment.gcsProjectId,
    bucket: environment.gcsArtifactsBucket,
    emulatorHost: environment.storageEmulatorHost,
  };
}

/** Defaults to `process.env` (resolved inside the validated env module). */
export function createArtifactStorageFromEnv(
  source?: Record<string, string | undefined>,
): ArtifactStorage {
  const selection = selectArtifactStorage(parseStorageEnvironment(source));

  if (selection.kind === "none") {
    return createNoOpArtifactStorage();
  }

  return createGcsArtifactStorage({
    projectId: selection.projectId,
    bucket: selection.bucket,
    ...(selection.emulatorHost === undefined ? {} : { emulatorHost: selection.emulatorHost }),
  });
}
