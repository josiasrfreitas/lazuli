import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BetterAuthOptions } from "better-auth";

import { createAuthOptions, THIRTY_DAY_SESSION_SECONDS } from "../src/auth-options.js";
import type { AuthOptionsInput, MagicLinkDelivery, MagicLinkSender } from "../src/index.js";

const TEST_BASE_URL = "http://localhost:3000";
const TEST_SECRET = "test-secret";
const GOOGLE_CLIENT_ID = "google-client-id";
const GOOGLE_CLIENT_SECRET = "google-client-secret";

function createTestOptions(overrides: Partial<AuthOptionsInput> = {}): BetterAuthOptions {
  return createAuthOptions({
    baseUrl: TEST_BASE_URL,
    secret: TEST_SECRET,
    googleClientId: GOOGLE_CLIENT_ID,
    googleClientSecret: GOOGLE_CLIENT_SECRET,
    database: {},
    sendMagicLink: () => Promise.resolve(),
    ...overrides,
  });
}

void describe("Better Auth options", () => {
  void it("configures thirty-day sessions for staff auth", () => {
    const options = createTestOptions();

    assert.equal(options.session?.expiresIn, THIRTY_DAY_SESSION_SECONDS);
  });

  void it("configures Google OAuth credentials", () => {
    const options = createTestOptions();

    assert.deepEqual(options.socialProviders?.google, {
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      disableSignUp: true,
    });
  });

  void it("links a trusted Google sign-in to a pre-provisioned, unverified email", () => {
    const options = createTestOptions();

    assert.deepEqual(options.account?.accountLinking, {
      enabled: true,
      requireLocalEmailVerified: false,
      trustedProviders: ["google"],
    });
  });

  void it("routes magic-link delivery through the injected sender", async () => {
    const deliveries: MagicLinkDelivery[] = [];
    const sendMagicLink: MagicLinkSender = (delivery) => {
      deliveries.push(delivery);
      return Promise.resolve();
    };
    const options = createTestOptions({ sendMagicLink });

    const magicLinkPlugin = options.plugins?.find((plugin) => plugin.id === "magic-link") as
      | { options: { sendMagicLink: MagicLinkSender } }
      | undefined;
    assert.notEqual(magicLinkPlugin, undefined);

    await magicLinkPlugin?.options.sendMagicLink({
      email: "teacher@example.com",
      url: `${TEST_BASE_URL}/api/auth/magic-link/verify?token=token`,
      token: "token",
    });

    assert.deepEqual(deliveries, [
      {
        email: "teacher@example.com",
        url: `${TEST_BASE_URL}/api/auth/magic-link/verify?token=token`,
        token: "token",
      },
    ]);
  });
});
