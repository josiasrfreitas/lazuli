import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { createSharedInfrastructure } from "./shared.ts";
import { createCompute } from "./compute.ts";
import { createAutomation } from "./automation.ts";

const stack = pulumi.getStack();
if (!["staging", "prod", "billing", "shared", "automation"].includes(stack)) {
  throw new Error("Use uma stack Lazuli: staging, prod, shared, billing ou automation.");
}

function createBudget(): void {
  const email = new pulumi.Config().requireSecret("budgetAlertEmail");
  const notification = (threshold: number, notificationType: "ACTUAL" | "FORECASTED") => ({
    comparisonOperator: "GREATER_THAN",
    notificationType,
    subscriberEmailAddresses: [email],
    threshold,
    thresholdType: "PERCENTAGE",
  });

  new aws.budgets.Budget(
    "lazuli-monthly-account",
    {
      name: "lazuli-monthly-account",
      budgetType: "COST",
      limitAmount: "20",
      limitUnit: "USD",
      timeUnit: "MONTHLY",
      notifications: [
        notification(50, "ACTUAL"),
        notification(80, "ACTUAL"),
        notification(100, "ACTUAL"),
        notification(100, "FORECASTED"),
      ],
    },
    { protect: true },
  );
}

function createPrivateFiles(environment: "staging" | "prod"): aws.s3.Bucket {
  const tags = { Project: "lazuli", Environment: environment };

  // A unique physical name keeps staging and production files in separate buckets.
  const files = new aws.s3.Bucket(
    `lazuli-${environment}-private-files`,
    { tags },
    { protect: true },
  );

  new aws.s3.BucketPublicAccessBlock(
    "private-files-public-access",
    {
      bucket: files.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    },
    { protect: true },
  );

  new aws.s3.BucketOwnershipControls(
    "private-files-ownership",
    { bucket: files.id, rule: { objectOwnership: "BucketOwnerEnforced" } },
    { protect: true },
  );

  new aws.s3.BucketServerSideEncryptionConfiguration(
    "private-files-encryption",
    {
      bucket: files.id,
      rules: [{ applyServerSideEncryptionByDefault: { sseAlgorithm: "AES256" } }],
    },
    { protect: true },
  );

  const tlsOnly = aws.iam.getPolicyDocumentOutput({
    statements: [
      {
        sid: "DenyInsecureTransport",
        effect: "Deny",
        actions: ["s3:*"],
        principals: [{ type: "*", identifiers: ["*"] }],
        resources: [files.arn, pulumi.interpolate`${files.arn}/*`],
        conditions: [{ test: "Bool", variable: "aws:SecureTransport", values: ["false"] }],
      },
    ],
  });

  new aws.s3.BucketPolicy(
    "private-files-tls-only",
    { bucket: files.id, policy: tlsOnly.json },
    { protect: true },
  );

  return files;
}

if (stack === "billing") createBudget();
const files = stack === "staging" || stack === "prod" ? createPrivateFiles(stack) : undefined;
export const shared = stack === "shared" ? createSharedInfrastructure() : undefined;
export const compute =
  files &&
  (stack === "staging" || stack === "prod") &&
  new pulumi.Config().getBoolean("enableCompute")
    ? createCompute(stack, files)
    : undefined;

export const bucketName = files?.bucket ?? "";
export const region = aws.config.region;
export const automation = stack === "automation" ? createAutomation() : undefined;
