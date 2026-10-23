import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const stack = process.argv[2];
assert.ok(stack === "staging" || stack === "prod", "Usage: node check-storage.mjs staging|prod");
const profile = process.env.AWS_PROFILE || "lazuli";
const region = "us-east-2";
function aws(...args) {
  const result = execFileSync(
    "aws",
    [...args, "--profile", profile, "--region", region, "--output", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  return result.trim() ? JSON.parse(result) : {};
}
assert.equal(aws("sts", "get-caller-identity").Account, "413781344359");
assert.ok(!process.env.PULUMI_BACKEND_URL, "Use the project S3 backend");
const bucket = JSON.parse(
  execFileSync(
    "pulumi",
    ["stack", "output", "bucketName", "--stack", stack, "--json", "--non-interactive"],
    {
      cwd: fileURLToPath(new URL(".", import.meta.url)),
      env: { ...process.env, AWS_PROFILE: profile, AWS_REGION: region },
      encoding: "utf8",
    },
  ),
);
assert.ok(bucket.startsWith(`lazuli-${stack}-private-files-`));
assert.equal(aws("s3api", "get-bucket-location", "--bucket", bucket).LocationConstraint, region);
assert.deepEqual(
  aws("s3api", "get-public-access-block", "--bucket", bucket).PublicAccessBlockConfiguration,
  {
    BlockPublicAcls: true,
    IgnorePublicAcls: true,
    BlockPublicPolicy: true,
    RestrictPublicBuckets: true,
  },
);
assert.equal(
  aws("s3api", "get-bucket-ownership-controls", "--bucket", bucket).OwnershipControls.Rules[0]
    .ObjectOwnership,
  "BucketOwnerEnforced",
);
assert.equal(
  aws("s3api", "get-bucket-encryption", "--bucket", bucket).ServerSideEncryptionConfiguration
    .Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm,
  "AES256",
);
const policy = JSON.parse(aws("s3api", "get-bucket-policy", "--bucket", bucket).Policy);
assert.ok(
  policy.Statement.some(
    (statement) =>
      statement.Effect === "Deny" && statement.Condition?.Bool?.["aws:SecureTransport"] === "false",
  ),
  "Expected HTTP denial",
);

const directory = mkdtempSync(join(tmpdir(), "lazuli-storage-check-"));
const key = `__infra-checks/${randomUUID()}`;
const content = `Lazuli ${stack} infrastructure probe ${randomUUID()}\n`;
try {
  writeFileSync(join(directory, "input"), content, { mode: 0o600 });
  aws("s3api", "put-object", "--bucket", bucket, "--key", key, "--body", join(directory, "input"));
  aws("s3api", "get-object", "--bucket", bucket, "--key", key, join(directory, "output"));
  assert.equal(readFileSync(join(directory, "output"), "utf8"), content);
} finally {
  try {
    aws("s3api", "delete-object", "--bucket", bucket, "--key", key);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
console.log(
  `PASS: ${stack} S3 privacy/encryption/TLS configuration and operator write/read/delete probe.`,
);
console.log(
  "Runtime IAM isolation must be checked from the corresponding EC2 role after provisioning.",
);
