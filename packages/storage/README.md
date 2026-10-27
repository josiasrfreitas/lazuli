# Storage

`@lazuli/storage` owns server-side file operations: `put`, `read`, and `remove`.
It uses Amazon S3 in production and Adobe S3Mock locally through the same SDK.

Applications authorize access before calling storage. Keep filenames, owners and other metadata
in PostgreSQL; use opaque UUIDs in object keys. Persist the returned `{ bucket, key }` with the
attachment. When migrating buckets, explicitly configure `additionalBuckets` in `createStorage`
for reads/removals of historical references; uploads always use the configured primary bucket.
References outside these configured buckets are rejected before contacting S3. The package does not
create public URLs or set public ACLs. Downloads go through an authenticated application endpoint.

## Canonical integration

The provider-independent `Storage`, `StoredFile`, and `StoredFileReference` contracts live in
`src/contracts.ts`. Consumers import them from `@lazuli/storage`; the S3 implementation and
configuration remain inside this package. Use `getStorage()` for the environment-configured
singleton or `createStorage(options)` for an explicitly configured server integration.

For each feature:

1. Authorize the actor and validate the actual bytes, allowed types and size before `put`.
2. Generate an opaque key on the server (for example `student-attachments/${randomUUID()}`).
   Never use a person's name, document number or the uploaded filename in the key.
3. Persist the returned reference with filename, MIME type, byte length, owner and uploader in
   PostgreSQL. If persistence fails, remove the uploaded object; arrange retry/reconciliation if
   cleanup fails. S3 and PostgreSQL do not share a transaction.
4. For reads and removal, authorize against the database record and use its stored reference.
   A bucket allowlist is an environment boundary, not per-user authorization.
5. Process heavy work through the worker with identifiers only; keep bytes and personal data out
   of job payloads and logs.

Existing integrations: `packages/api/src/assessment-files/transport.ts` and
`packages/api/src/admissions/placement.ts`; worker reads use this same package.
Student documents, profile photos, QR capture and OCR remain future feature work tracked in
[issue #219](https://github.com/josiasrfreitas/lazuli/issues/219). Storage does not implement their
schemas, permissions, upload routes or OCR engine.

## Local development

From the repository root, run `docker compose up -d s3`. Data persists in `s3-data`.
The HTTP endpoint is `http://localhost:9090`; no AWS account or credentials are needed.
The first upload creates the workspace bucket automatically. Workspace setup writes `S3_BUCKET`;
older worktrees fall back to a stable bucket derived from the isolated database identity.
Run `docker compose up -d s3` once from a checkout containing this service; it is shared per machine.

| Variable        | Development                                      | Production                                |
| --------------- | ------------------------------------------------ | ----------------------------------------- |
| `S3_BUCKET`     | Workspace bucket, or derived from `DATABASE_URL` | Required, pre-provisioned private bucket  |
| `S3_ENDPOINT`   | Defaults to `http://localhost:9090`              | Omit for AWS S3                           |
| `AWS_REGION`    | Defaults to `us-east-1`                          | Region containing the bucket              |
| AWS credentials | Fixed dummy credentials                          | SDK credential chain, preferably IAM role |

Production requires `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` on the application prefix.
Bucket provisioning, public-access blocking, encryption and retention belong to infrastructure;
the application never creates a production bucket. Configure `NODE_ENV=production` for AWS.

`createStorage` also accepts explicit configuration for server integrations. Do not expose raw
bucket/key inputs to unauthenticated callers. File type and size rules belong to the feature.

References: [AWS SDK v3 S3 examples](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html),
[S3Mock configuration](https://github.com/adobe/S3Mock/tree/5.2.3).
