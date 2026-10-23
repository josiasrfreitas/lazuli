import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const profile = process.env.AWS_PROFILE || "lazuli";
const region = "us-east-2";
function aws(...args) {
  return JSON.parse(
    execFileSync("aws", [...args, "--profile", profile, "--region", region, "--output", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }),
  );
}

assert.equal(aws("sts", "get-caller-identity").Account, "413781344359", "Wrong AWS account");
assert.ok(!process.env.PULUMI_BACKEND_URL, "Remove PULUMI_BACKEND_URL; use the project S3 backend");
const shared = JSON.parse(
  execFileSync(
    "pulumi",
    ["stack", "output", "shared", "--stack", "shared", "--json", "--non-interactive"],
    {
      cwd: fileURLToPath(new URL(".", import.meta.url)),
      encoding: "utf8",
      env: { ...process.env, AWS_PROFILE: profile, AWS_REGION: region },
      stdio: ["ignore", "pipe", "inherit"],
    },
  ),
);

const [database] = aws(
  "rds",
  "describe-db-instances",
  "--db-instance-identifier",
  shared.databaseIdentifier,
).DBInstances;
assert.equal(database.DBInstanceStatus, "available", "RDS is not available yet");
assert.equal(database.Engine, "postgres");
assert.ok(database.EngineVersion.startsWith("16."), "Expected PostgreSQL 16");
assert.equal(database.PubliclyAccessible, false, "Database must be private");
assert.equal(database.StorageEncrypted, true, "Storage encryption is required");
assert.equal(database.DeletionProtection, true, "Deletion protection is required");
assert.ok(database.BackupRetentionPeriod >= 7, "Expected at least seven days of backups");
assert.equal(database.DBSubnetGroup.VpcId, shared.vpcId);
assert.equal(database.Endpoint.Address, shared.databaseAddress);
assert.equal(database.MasterUserSecret?.SecretStatus, "active", "Admin secret is not active");
assert.deepEqual(
  database.VpcSecurityGroups.map((group) => group.VpcSecurityGroupId),
  [shared.databaseSecurityGroupId],
);
assert.ok(database.DBParameterGroups.every((group) => group.ParameterApplyStatus === "in-sync"));
const parameters = aws(
  "rds",
  "describe-db-parameters",
  "--db-parameter-group-name",
  database.DBParameterGroups[0].DBParameterGroupName,
).Parameters;
assert.equal(
  parameters.find((parameter) => parameter.ParameterName === "rds.force_ssl")?.ParameterValue,
  "1",
  "TLS must be mandatory",
);

const [group] = aws(
  "ec2",
  "describe-security-groups",
  "--group-ids",
  shared.databaseSecurityGroupId,
).SecurityGroups;
const allowedClients = new Set(Object.values(shared.clientSecurityGroupIds));
const observedClients = new Set();
for (const rule of group.IpPermissions) {
  assert.equal(rule.IpProtocol, "tcp");
  assert.equal(rule.FromPort, 5432);
  assert.equal(rule.ToPort, 5432);
  assert.equal(
    rule.IpRanges.length + rule.Ipv6Ranges.length + rule.PrefixListIds.length,
    0,
    "Database ingress must use client security groups, never CIDRs",
  );
  for (const source of rule.UserIdGroupPairs) {
    assert.ok(allowedClients.has(source.GroupId), "Unexpected database client");
    observedClients.add(source.GroupId);
  }
}
assert.deepEqual(observedClients, allowedClients, "Both environment client groups must be allowed");
console.log(
  "PASS: RDS available; private, encrypted, TLS required, backups and network access configured.",
);
console.log(
  "PENDING: SQL login, environment isolation, migrations and restore drill require private network access.",
);
