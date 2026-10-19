# Storage

`@lazuli/storage` owns server-side file operations: `put`, `read`, and `remove`.
It uses Amazon S3 in production and Adobe S3Mock locally through the same SDK.

Applications authorize access before calling storage. Keep filenames, owners and other metadata
in PostgreSQL; use opaque UUIDs in object keys. Persist the returned `{ bucket, key }` with the
attachment so changing the default bucket does not break existing files. The package does not
create public URLs or set public ACLs. Downloads go through an authenticated application endpoint.

## Local development

From the repository root, run `docker compose up -d s3`. Data persists in `s3-data`.
The HTTP endpoint is `http://localhost:9090`; no AWS account or credentials are needed.
The first upload creates the workspace bucket automatically. Workspace setup writes `S3_BUCKET`;
older worktrees fall back to a stable bucket derived from the isolated database identity.
Run `docker compose up -d s3` once from a checkout containing this service; it is shared per machine.

| Variable | Development | Production |
| --- | --- | --- |
| `S3_BUCKET` | Workspace bucket, or derived from `DATABASE_URL` | Required, pre-provisioned private bucket |
| `S3_ENDPOINT` | Defaults to `http://localhost:9090` | Omit for AWS S3 |
| `AWS_REGION` | Defaults to `us-east-1` | Region containing the bucket |
| AWS credentials | Fixed dummy credentials | SDK credential chain, preferably IAM role |

Production requires `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` on the application prefix.
Bucket provisioning, public-access blocking, encryption and retention belong to infrastructure;
the application never creates a production bucket. Configure `NODE_ENV=production` for AWS.

`createStorage` also accepts explicit configuration for server integrations. Do not expose raw
bucket/key inputs to unauthenticated callers. File type and size rules belong to the feature.

References: [AWS SDK v3 S3 examples](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html),
[S3Mock configuration](https://github.com/adobe/S3Mock/tree/5.2.3).
