import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createEmailSenderFromEnv,
  createResendEmailSender,
  createSmtpEmailSender,
  EmailBodyMissingError,
  parseEmailEnvironment,
  requireEmailBody,
  selectEmailTransport,
} from "../src/index.js";

const FROM_ADDRESS = "Lazuli <no-reply@example.com>";
const MAILPIT_SMTP_PORT = 1025;
const CUSTOM_SMTP_PORT = 2525;
const RECIPIENT = "admin@example.com";
const SUBJECT = "probe";

function environmentSource(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return { EMAIL_FROM: FROM_ADDRESS, ...overrides };
}

void describe("parseEmailEnvironment", () => {
  void it("treats an empty RESEND_API_KEY as absent", () => {
    const environment = parseEmailEnvironment(environmentSource({ RESEND_API_KEY: "" }));

    assert.equal(environment.resendApiKey, undefined);
  });

  void it("treats a whitespace-only RESEND_API_KEY as absent", () => {
    const environment = parseEmailEnvironment(environmentSource({ RESEND_API_KEY: "   " }));

    assert.equal(environment.resendApiKey, undefined);
  });

  void it("defaults SMTP host and port to the local Mailpit endpoint", () => {
    const environment = parseEmailEnvironment(environmentSource());

    assert.equal(environment.smtpHost, "localhost");
    assert.equal(environment.smtpPort, MAILPIT_SMTP_PORT);
  });

  void it("reads explicit SMTP settings", () => {
    const environment = parseEmailEnvironment(
      environmentSource({ SMTP_HOST: "mailpit.internal", SMTP_PORT: String(CUSTOM_SMTP_PORT) }),
    );

    assert.equal(environment.smtpHost, "mailpit.internal");
    assert.equal(environment.smtpPort, CUSTOM_SMTP_PORT);
  });

  void it("rejects a missing EMAIL_FROM", () => {
    assert.throws(() => parseEmailEnvironment({}));
  });

  void it("rejects a non-numeric SMTP_PORT", () => {
    assert.throws(() => parseEmailEnvironment(environmentSource({ SMTP_PORT: "smtp" })));
  });
});

void describe("selectEmailTransport", () => {
  void it("selects Resend when an API key is present", () => {
    const selection = selectEmailTransport(
      parseEmailEnvironment(environmentSource({ RESEND_API_KEY: "re_test_key" })),
    );

    assert.deepEqual(selection, { kind: "resend", apiKey: "re_test_key", from: FROM_ADDRESS });
  });

  void it("selects SMTP when the API key is empty (Mailpit convention)", () => {
    const selection = selectEmailTransport(
      parseEmailEnvironment(environmentSource({ RESEND_API_KEY: "" })),
    );

    assert.deepEqual(selection, {
      kind: "smtp",
      host: "localhost",
      port: MAILPIT_SMTP_PORT,
      from: FROM_ADDRESS,
    });
  });
});

void describe("createEmailSenderFromEnv", () => {
  void it("constructs a sender without touching the network", () => {
    const sender = createEmailSenderFromEnv(environmentSource({ RESEND_API_KEY: "" }));

    assert.equal(typeof sender.send, "function");
  });
});

void describe("requireEmailBody", () => {
  void it("accepts html-only input", () => {
    assert.deepEqual(requireEmailBody({ to: RECIPIENT, subject: SUBJECT, html: "<p>hi</p>" }), {
      html: "<p>hi</p>",
    });
  });

  void it("accepts text-only input", () => {
    assert.deepEqual(requireEmailBody({ to: RECIPIENT, subject: SUBJECT, text: "hi" }), {
      text: "hi",
    });
  });

  void it("keeps both bodies when provided", () => {
    assert.deepEqual(
      requireEmailBody({ to: RECIPIENT, subject: SUBJECT, html: "<p>hi</p>", text: "hi" }),
      { html: "<p>hi</p>", text: "hi" },
    );
  });

  void it("rejects input without html or text", () => {
    assert.throws(
      () => requireEmailBody({ to: RECIPIENT, subject: SUBJECT }),
      (error: unknown) => error instanceof EmailBodyMissingError,
    );
  });
});

void describe("body validation happens before any network call", () => {
  void it("rejects body-less input in the Resend sender", async () => {
    const sender = createResendEmailSender({ apiKey: "re_test_key", from: FROM_ADDRESS });

    await assert.rejects(
      sender.send({ to: RECIPIENT, subject: SUBJECT }),
      (error: unknown) => error instanceof EmailBodyMissingError,
    );
  });

  void it("rejects body-less input in the SMTP sender", async () => {
    const sender = createSmtpEmailSender({
      host: "localhost",
      port: MAILPIT_SMTP_PORT,
      from: FROM_ADDRESS,
    });

    await assert.rejects(
      sender.send({ to: RECIPIENT, subject: SUBJECT }),
      (error: unknown) => error instanceof EmailBodyMissingError,
    );
  });
});
