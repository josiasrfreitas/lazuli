import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { URL } from "node:url";

const script = new URL("../runtime-check.mjs", import.meta.url);

function check(overrides = {}) {
  const environment = {
    PATH: process.env.PATH,
    LAZULI_ENV: "staging",
    NODE_ENV: "production",
    APP_URL: "https://staging.lazuli.test",
    BETTER_AUTH_URL: "https://staging.lazuli.test",
    BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
    DATABASE_URL: "postgresql://lazuli:secret@db.test/lazuli_staging",
    EMAIL_FROM: "Lazuli <no-reply@example.com>",
    SMTP_HOST: "mailpit.internal",
    SMTP_PORT: "1025",
    AWS_REGION: "us-east-2",
    S3_BUCKET: "lazuli-staging-private-files-123",
    HATCHET_CLIENT_TOKEN: "staging-token",
    HATCHET_CLIENT_NAMESPACE: "lazuli-staging",
    ...overrides,
  };
  return spawnSync(process.execPath, [script.pathname, "--remote"], {
    encoding: "utf8",
    env: environment,
  });
}

void describe("remote runtime isolation", () => {
  void it("accepts an isolated staging configuration", () => {
    assert.equal(check().status, 0);
  });

  void it("accepts a staging Resend key without Mailpit settings", () => {
    const result = check({
      EMAIL_FROM: "Lazuli <noreply@staging.lazuli.fisklagarto.com.br>",
      RESEND_API_KEY: "re_test_key",
      SMTP_HOST: undefined,
      SMTP_PORT: undefined,
    });
    assert.equal(result.status, 0, result.stderr);
  });

  void it("requires Mailpit settings when staging has no Resend key", () => {
    const result = check({ SMTP_HOST: undefined, SMTP_PORT: undefined });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /SMTP_HOST/);
    assert.match(result.stderr, /SMTP_PORT/);
  });

  void it("rejects a placeholder sender when staging uses Resend", () => {
    const result = check({ RESEND_API_KEY: "re_test_key" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Resend EMAIL_FROM must use a verified real domain/);
  });

  void it("rejects the region blocked by the AWS project policy", () => {
    const result = check({ AWS_REGION: "us-east-1" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /AWS_REGION must be us-east-2/);
  });

  void it("accepts an isolated production configuration", () => {
    const result = check({
      LAZULI_ENV: "prod",
      APP_URL: "https://app.lazuli.test",
      BETTER_AUTH_URL: "https://app.lazuli.test",
      DATABASE_URL: "postgresql://lazuli:secret@db.test/lazuli_prod",
      EMAIL_FROM: "Lazuli <no-reply@lazuli.test>",
      RESEND_API_KEY: "re_test_key",
      SMTP_HOST: undefined,
      SMTP_PORT: undefined,
      S3_BUCKET: "lazuli-prod-private-files-123",
      HATCHET_CLIENT_NAMESPACE: "lazuli-prod",
    });
    assert.equal(result.status, 0, result.stderr);
  });

  void it("rejects production resources in staging", () => {
    const result = check({
      DATABASE_URL: "postgresql://lazuli:secret@db.test/lazuli_prod",
      S3_BUCKET: "lazuli-prod-private-files-123",
      HATCHET_CLIENT_NAMESPACE: "lazuli-prod",
    });
    assert.equal(result.status, 1);
    for (const name of ["DATABASE_URL", "S3_BUCKET", "HATCHET_CLIENT_NAMESPACE"]) {
      assert.match(result.stderr, new RegExp(name));
    }
  });

  void it("rejects a local deployment and static AWS credentials", () => {
    const result = check({ LAZULI_ENV: "local", AWS_ACCESS_KEY_ID: "test" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /LAZULI_ENV=staging or LAZULI_ENV=prod/);
  });
});
