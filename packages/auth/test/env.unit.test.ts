import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveGoogleOAuth } from "../src/env.js";

void describe("auth environment", () => {
  void it("disables Google locally when both credentials are empty", () => {
    const googleOAuth = resolveGoogleOAuth({ clientId: "", clientSecret: "", production: false });

    assert.equal(googleOAuth, undefined);
  });

  void it("rejects a partial Google credential pair", () => {
    assert.throws(
      () => resolveGoogleOAuth({ clientId: "client-id", clientSecret: "", production: false }),
      /GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together/u,
    );
  });

  void it("requires Google credentials in production", () => {
    assert.throws(
      () => resolveGoogleOAuth({ clientId: undefined, clientSecret: undefined, production: true }),
      /required in production/u,
    );
  });
});
