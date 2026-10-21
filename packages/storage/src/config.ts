import { createHash } from "node:crypto";
import type { StorageOptions } from "./storage.js";

const BUCKET_IDENTITY_LENGTH = 20;

/** Old worktrees also get an isolated bucket before their next workspace setup. */
function localBucket(environment: NodeJS.ProcessEnv): string {
  if (!environment.DATABASE_URL) {
    throw new Error("Configure S3_BUCKET or DATABASE_URL for isolated local storage.");
  }
  const database = new URL(environment.DATABASE_URL);
  const identity = `${database.host}${database.pathname}`;
  return `lazuli-local-${createHash("sha256").update(identity).digest("hex").slice(0, BUCKET_IDENTITY_LENGTH)}`;
}

export function storageConfig(): StorageOptions {
  const environment = process.env;
  const local = environment.NODE_ENV !== "production";
  const bucket = environment.S3_BUCKET || (local ? localBucket(environment) : "");
  if (!bucket) throw new Error("S3_BUCKET is required in production.");
  const endpoint = environment.S3_ENDPOINT || (local ? "http://localhost:9090" : undefined);
  return {
    bucket,
    createLocalBucket: local,
    client: {
      region: environment.AWS_REGION || "us-east-1",
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      // Production uses the SDK credential chain (including IAM task/instance roles).
      ...(local ? { credentials: { accessKeyId: "local", secretAccessKey: "local" } } : {}),
    },
  };
}
