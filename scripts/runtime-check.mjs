import { URL } from "node:url";

import { REQUIRED_RUNTIME_ENVIRONMENT } from "./runtime-env.mjs";

const MINIMUM_AUTH_SECRET_LENGTH = 32;

const missing = [];
const invalid = [];
const environment = new Map(Object.entries(process.env));
const remote = process.argv.includes("--remote");
const deploymentEnvironment = getEnvironmentValue("LAZULI_ENV");

for (const name of REQUIRED_RUNTIME_ENVIRONMENT) {
  requireValue(name);
}

requireUrl("APP_URL");
requireMinimumLength("BETTER_AUTH_SECRET", MINIMUM_AUTH_SECRET_LENGTH);

if (remote) {
  validateRemoteEnvironment();
} else if (deploymentEnvironment && !["local", "staging", "prod"].includes(deploymentEnvironment)) {
  invalid.push("LAZULI_ENV must be local, staging or prod.");
}

if (deploymentEnvironment !== "prod" && !hasValue("RESEND_API_KEY")) {
  requireValue("SMTP_HOST");
  requireValue("SMTP_PORT");
  requirePositiveInteger("SMTP_PORT");
}

if (missing.length > 0 || invalid.length > 0) {
  for (const name of missing) {
    process.stderr.write(`Missing required environment variable: ${name}\n`);
  }

  for (const message of invalid) {
    process.stderr.write(`${message}\n`);
  }

  process.stderr.write(
    remote
      ? "\nRemote runtime preflight failed. Check the deployment environment.\n"
      : "\nRuntime preflight failed. Check the root .env file.\n",
  );
  process.exitCode = 1;
} else {
  process.stdout.write("Runtime preflight passed.\n");
}

function requireValue(name) {
  if (!hasValue(name)) {
    missing.push(name);
  }
}

function requireUrl(name) {
  const value = getEnvironmentValue(name);

  if (!hasValue(name)) {
    return;
  }

  try {
    new URL(value);
  } catch {
    invalid.push(`${name} must be a valid URL.`);
  }
}

function requireMinimumLength(name, minimumLength) {
  const value = getEnvironmentValue(name);

  if (!hasValue(name)) {
    return;
  }

  if (value.length < minimumLength) {
    invalid.push(`${name} must be at least ${minimumLength} characters.`);
  }
}

function requirePositiveInteger(name) {
  const value = getEnvironmentValue(name);

  if (!hasValue(name)) {
    return;
  }

  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    invalid.push(`${name} must be a positive integer.`);
  }
}

function hasValue(name) {
  const value = getEnvironmentValue(name);

  return value !== undefined && value.length > 0;
}

function getEnvironmentValue(name) {
  return environment.get(name);
}

function validateRemoteEnvironment() {
  if (deploymentEnvironment !== "staging" && deploymentEnvironment !== "prod") {
    invalid.push("Remote runtime requires LAZULI_ENV=staging or LAZULI_ENV=prod.");
    return;
  }
  if (getEnvironmentValue("NODE_ENV") !== "production") {
    invalid.push("Remote runtime requires NODE_ENV=production.");
  }

  validateRemoteUrls();
  validateRemoteStorage();
  validateRemoteHatchetAndDatabase();
  validateRemoteCredentials();
  validateRemoteEmail();
}

function validateRemoteUrls() {
  for (const name of ["APP_URL", "BETTER_AUTH_URL"]) {
    requireValue(name);
    if (hasValue(name)) {
      try {
        if (new URL(getEnvironmentValue(name)).protocol !== "https:") {
          invalid.push(`${name} must use HTTPS in a remote environment.`);
        }
      } catch {
        invalid.push(`${name} must be a valid HTTPS URL.`);
      }
    }
  }
  if (
    hasValue("APP_URL") &&
    hasValue("BETTER_AUTH_URL") &&
    getEnvironmentValue("APP_URL") !== getEnvironmentValue("BETTER_AUTH_URL")
  ) {
    invalid.push("APP_URL and BETTER_AUTH_URL must match.");
  }
}

function validateRemoteStorage() {
  requireValue("S3_BUCKET");
  if (
    hasValue("S3_BUCKET") &&
    !getEnvironmentValue("S3_BUCKET").startsWith(`lazuli-${deploymentEnvironment}-`)
  ) {
    invalid.push(`S3_BUCKET must be the lazuli-${deploymentEnvironment} bucket.`);
  }
  if (hasValue("S3_ENDPOINT")) invalid.push("S3_ENDPOINT must be unset in AWS.");
  if (getEnvironmentValue("AWS_REGION") !== "us-east-2") {
    invalid.push("AWS_REGION must be us-east-2 for these stacks.");
  }
}

function validateRemoteHatchetAndDatabase() {
  requireValue("HATCHET_CLIENT_TOKEN");
  if (getEnvironmentValue("HATCHET_CLIENT_NAMESPACE") !== `lazuli-${deploymentEnvironment}`) {
    invalid.push(`HATCHET_CLIENT_NAMESPACE must be lazuli-${deploymentEnvironment}.`);
  }

  if (hasValue("DATABASE_URL")) {
    try {
      const database = new URL(getEnvironmentValue("DATABASE_URL"));
      if (
        !["postgres:", "postgresql:"].includes(database.protocol) ||
        database.pathname !== `/lazuli_${deploymentEnvironment}`
      ) {
        invalid.push(
          `DATABASE_URL must point to the PostgreSQL database lazuli_${deploymentEnvironment}.`,
        );
      }
    } catch {
      invalid.push("DATABASE_URL must be a valid PostgreSQL URL.");
    }
  }
}

function validateRemoteCredentials() {
  for (const name of [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "STORAGE_EMULATOR_HOST",
    "GOOGLE_APPLICATION_CREDENTIALS",
  ]) {
    if (hasValue(name)) invalid.push(`${name} must be unset in the remote runtime.`);
  }
}

function validateRemoteEmail() {
  if (deploymentEnvironment === "staging") {
    if (hasValue("RESEND_API_KEY")) invalid.push("Staging must not have RESEND_API_KEY.");
    requireValue("SMTP_HOST");
    requireValue("SMTP_PORT");
    if (getEnvironmentValue("SMTP_PORT") !== "1025") {
      invalid.push("Staging SMTP_PORT must be 1025 for Mailpit.");
    }
  } else {
    requireValue("RESEND_API_KEY");
    if (getEnvironmentValue("EMAIL_FROM")?.includes("example.com")) {
      invalid.push("Production EMAIL_FROM must use a verified real domain.");
    }
  }
}
