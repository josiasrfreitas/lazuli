import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";

export type StoredFileReference = { bucket: string; key: string };
export type StoredFile = { bytes: Uint8Array; contentType: string };
export type Storage = {
  put(file: StoredFile & { key: string }): Promise<StoredFileReference>;
  read(file: StoredFileReference): Promise<StoredFile>;
  remove(file: StoredFileReference): Promise<void>;
};

/** Server-only. Callers own authorization, size limits and database metadata. */
export function createStorage(options: {
  bucket: string;
  client: S3ClientConfig;
  createLocalBucket?: boolean;
}): Storage {
  const client = new S3Client(options.client);
  let bucketReady: Promise<void> | undefined;
  function prepareBucket(): Promise<void> {
    if (!options.createLocalBucket) return Promise.resolve();
    bucketReady ??= client
      .send(new CreateBucketCommand({ Bucket: options.bucket }))
      .then(() => {})
      .catch((error: Error) => {
        if (
          error instanceof Error &&
          (error.name === "BucketAlreadyOwnedByYou" || error.name === "BucketAlreadyExists")
        )
          return;
        bucketReady = undefined;
        throw error;
      });
    return bucketReady;
  }
  return {
    async put(file) {
      const reference = { bucket: options.bucket, key: file.key };
      const input = objectInput(reference);
      await prepareBucket();
      await client.send(
        new PutObjectCommand({
          ...input,
          Body: file.bytes,
          ContentType: file.contentType,
        }),
      );
      return reference;
    },
    async read(file) {
      const result = await client.send(new GetObjectCommand(objectInput(file)));
      if (!result.Body) throw new Error("Storage returned an empty response body.");
      return {
        bytes: await result.Body.transformToByteArray(),
        contentType: result.ContentType ?? "application/octet-stream",
      };
    },
    async remove(file) {
      await client.send(new DeleteObjectCommand(objectInput(file)));
    },
  };
}

function objectInput(file: StoredFileReference): { Bucket: string; Key: string } {
  if (!file.key || !file.bucket) throw new Error("Storage requires a bucket and object key.");
  return { Bucket: file.bucket, Key: file.key };
}
