// Local bootstrap after `pulumi up --stack automation`. Never prints secret values.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const repository = "josiasrfreitas/lazuli";
function gh(args, input) {
  return execFileSync("gh", args, { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}
try {
  assert.equal(
    JSON.parse(gh(["repo", "view", repository, "--json", "nameWithOwner"])).nameWithOwner,
    repository,
  );
  const outputs = JSON.parse(
    execFileSync("pulumi", ["stack", "output", "automation", "--stack", "automation", "--json"], {
      cwd: new URL("../pulumi", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  assert.ok(process.env.PULUMI_CONFIG_PASSPHRASE_FILE, "Set PULUMI_CONFIG_PASSPHRASE_FILE");
  const passphrase = readFileSync(process.env.PULUMI_CONFIG_PASSPHRASE_FILE, "utf8").trimEnd();
  assert.ok(passphrase.length > 0);
  for (const name of ["infra-apply", "app-staging", "app-prod"]) {
    let existing;
    try {
      existing = JSON.parse(gh(["api", `repos/${repository}/environments/${name}`]));
    } catch (error) {
      if (!String(error.stderr).includes("404")) throw error;
    }
    if (existing) {
      assert.equal(
        existing.deployment_branch_policy?.custom_branch_policies,
        true,
        `Environment ${name} must restrict deployment branches`,
      );
    } else
      gh(
        ["api", "--method", "PUT", `repos/${repository}/environments/${name}`, "--input", "-"],
        JSON.stringify({
          deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
        }),
      );
    const branches = JSON.parse(
      gh(["api", `repos/${repository}/environments/${name}/deployment-branch-policies`]),
    ).branch_policies;
    const allowedBranches = name === "app-staging" ? ["main", "staging/*"] : ["main"];
    assert.ok(
      branches.every((policy) => allowedBranches.includes(policy.name) && policy.type === "branch"),
      `Environment ${name} allows unexpected branches/tags`,
    );
    for (const branch of allowedBranches) {
      if (branches.some((policy) => policy.name === branch)) continue;
      gh(
        [
          "api",
          "--method",
          "POST",
          `repos/${repository}/environments/${name}/deployment-branch-policies`,
          "--input",
          "-",
        ],
        JSON.stringify({ name: branch, type: "branch" }),
      );
    }
  }
  gh([
    "variable",
    "set",
    "AWS_INFRA_PREVIEW_ROLE_ARN",
    "--repo",
    repository,
    "--body",
    outputs.previewRoleArn,
  ]);
  gh([
    "variable",
    "set",
    "AWS_INFRA_APPLY_ROLE_ARN",
    "--repo",
    repository,
    "--body",
    outputs.applyRoleArn,
  ]);
  for (const environment of ["staging", "prod"]) {
    gh([
      "variable",
      "set",
      "AWS_DEPLOY_ROLE_ARN",
      "--repo",
      repository,
      "--env",
      `app-${environment}`,
      "--body",
      outputs.deployRoleArns[environment],
    ]);
  }
  gh(["secret", "set", "PULUMI_CONFIG_PASSPHRASE", "--repo", repository], passphrase);
  gh(
    ["secret", "set", "PULUMI_BILLING_CONFIG", "--repo", repository],
    readFileSync(new URL("../pulumi/Pulumi.billing.yaml", import.meta.url), "utf8"),
  );
  console.log("Configured GitHub environments, role variables and encrypted secrets.");
} catch {
  console.error(
    "GitHub bootstrap incomplete. Check automation outputs and existing environments privately; no secret values were logged.",
  );
  process.exitCode = 1;
}
