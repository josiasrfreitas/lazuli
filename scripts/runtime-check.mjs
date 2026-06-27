import { URL } from "node:url";

import { REQUIRED_RUNTIME_ENVIRONMENT } from "./runtime-env.mjs";

const MINIMUM_AUTH_SECRET_LENGTH = 32;

const missing = [];
const invalid = [];
const environment = new Map(Object.entries(process.env));

for (const name of REQUIRED_RUNTIME_ENVIRONMENT) {
  requireValue(name);
}

requireUrl("APP_URL");
requireMinimumLength("BETTER_AUTH_SECRET", MINIMUM_AUTH_SECRET_LENGTH);

if (!hasValue("RESEND_API_KEY")) {
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

  process.stderr.write("\nRuntime preflight failed. Check the root .env file.\n");
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
