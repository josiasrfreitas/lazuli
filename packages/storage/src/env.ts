import { createHash } from "node:crypto";
import type { S3ClientConfig } from "@aws-sdk/client-s3";

const BUCKET_HASH_LENGTH = 20;
export type StorageEnvironment = {
  bucket: string;
  client: S3ClientConfig;
  createLocalBucket: boolean;
};

function localBucket(databaseUrl: string | undefined): string {
  if (!databaseUrl)
    throw new Error("Configure S3_BUCKET or DATABASE_URL for isolated local storage.");
  const database = new URL(databaseUrl);
  const identity = `${database.host}${database.pathname}`;
  return `lazuli-local-${createHash("sha256").update(identity).digest("hex").slice(0, BUCKET_HASH_LENGTH)}`;
}

/** Production never infers a deployment region or creates buckets. */
export function readStorageEnvironment(): StorageEnvironment {
  return parseStorageEnvironment(process.env);
}

export function parseStorageEnvironment(environment: {
  NODE_ENV?: string | undefined;
  S3_BUCKET?: string | undefined;
  S3_ENDPOINT?: string | undefined;
  AWS_REGION?: string | undefined;
  DATABASE_URL?: string | undefined;
}): StorageEnvironment {
  const local = environment.NODE_ENV !== "production";
  const bucket = storageBucket(environment, local);
  const region = environment.AWS_REGION?.trim() || (local ? "us-east-1" : "");
  if (!bucket) throw new Error("S3_BUCKET is required in production.");
  if (!region) throw new Error("AWS_REGION is required in production.");
  const endpoint = storageEndpoint(environment.S3_ENDPOINT, local);
  return {
    bucket,
    createLocalBucket: local,
    client: {
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      ...(local ? { credentials: { accessKeyId: "local", secretAccessKey: "local" } } : {}),
    },
  };
}

function storageEndpoint(value: string | undefined, local: boolean): string | undefined {
  const endpoint = value?.trim() || (local ? "http://localhost:9090" : undefined);
  if (endpoint) new URL(endpoint);
  return endpoint;
}

function storageBucket(
  environment: { S3_BUCKET?: string | undefined; DATABASE_URL?: string | undefined },
  local: boolean,
): string {
  return environment.S3_BUCKET?.trim() || (local ? localBucket(environment.DATABASE_URL) : "");
}
