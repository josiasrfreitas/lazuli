import { z } from "zod";

/**
 * Treats empty/whitespace-only values as absent so `GCS_ARTIFACTS_BUCKET=`
 * counts as not-configured, consistent with the email adapters.
 */
const optionalTrimmedString = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
  });

const storageEnvironmentSchema = z.object({
  GCS_PROJECT_ID: optionalTrimmedString,
  GCS_ARTIFACTS_BUCKET: optionalTrimmedString,
  STORAGE_EMULATOR_HOST: optionalTrimmedString,
});

export type StorageEnvironment = {
  gcsProjectId: string | undefined;
  gcsArtifactsBucket: string | undefined;
  /** Set → fake-gcs-server emulator mode; unset → real GCS auth path. */
  storageEmulatorHost: string | undefined;
};

export function parseStorageEnvironment(
  source?: Record<string, string | undefined>,
): StorageEnvironment {
  const parsed = storageEnvironmentSchema.parse(source ?? process.env);

  return {
    gcsProjectId: parsed.GCS_PROJECT_ID,
    gcsArtifactsBucket: parsed.GCS_ARTIFACTS_BUCKET,
    storageEmulatorHost: parsed.STORAGE_EMULATOR_HOST,
  };
}
