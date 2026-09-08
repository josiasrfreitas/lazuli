import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { after, describe, it } from "node:test";

import { createSmtpEmailSender, parseEmailEnvironment } from "../src/index.js";

const MAILPIT_HTTP_PORT = 8025;
const POLL_INTERVAL_MS = 250;
const POLL_TIMEOUT_MS = 5000;

// Inject a static source so the test is self-contained and doesn't depend on
// EMAIL_FROM being present in the environment (it isn't in the CI job env).
// Mailpit's ports are fixed by spec, so SMTP host/port fall back to the
// localhost:1025 defaults in env.ts.
const environment = parseEmailEnvironment({
  EMAIL_FROM: "Lazuli <no-reply@example.com>",
});
const mailpitBaseUrl = `http://${environment.smtpHost}:${MAILPIT_HTTP_PORT}`;

type MailpitAddress = { Address: string };
type MailpitMessage = { Subject: string; To: MailpitAddress[] };
type MailpitSearchResponse = { messages: MailpitMessage[] };

void describe("SMTP email sender against Mailpit", () => {
  const subject = `GRE-48 Mailpit probe ${randomUUID()}`;

  void after(async () => {
    await deleteMessages(subject);
  });

  void it("delivers an email that Mailpit captures", async () => {
    const sender = createSmtpEmailSender({
      host: environment.smtpHost,
      port: environment.smtpPort,
      from: environment.emailFrom,
    });

    await sender.send({
      to: "mailpit-probe@example.com",
      subject,
      html: "<p>Mailpit integration probe</p>",
      text: "Mailpit integration probe",
    });

    const message = await waitForMessage(subject);

    assert.equal(message.Subject, subject);
    assert.equal(message.To[0]?.Address, "mailpit-probe@example.com");
  });
});

async function waitForMessage(subject: string): Promise<MailpitMessage> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  for (;;) {
    const found = await searchMessages(subject);

    if (found.length > 0) {
      return found[0] as MailpitMessage;
    }

    if (Date.now() > deadline) {
      throw new Error(`Mailpit did not capture message with subject "${subject}" in time`);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

async function searchMessages(subject: string): Promise<MailpitMessage[]> {
  const response = await fetch(`${mailpitBaseUrl}/api/v1/search?query=${searchQuery(subject)}`);

  if (!response.ok) {
    throw new Error(`Mailpit search failed with status ${response.status}`);
  }

  const payload = (await response.json()) as MailpitSearchResponse;
  return payload.messages;
}

async function deleteMessages(subject: string): Promise<void> {
  await fetch(`${mailpitBaseUrl}/api/v1/search?query=${searchQuery(subject)}`, {
    method: "DELETE",
  });
}

function searchQuery(subject: string): string {
  return encodeURIComponent(`subject:"${subject}"`);
}
