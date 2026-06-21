import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertLocalDatabaseUrl } from "../prisma/reset-url.js";

describe("database reset URL guard", () => {
  it("accepts the local Postgres URL used by Docker Compose", () => {
    assert.doesNotThrow(() =>
      assertLocalDatabaseUrl("postgresql://lazuli:lazuli@localhost:5432/lazuli?schema=public"),
    );
  });

  it("rejects non-Postgres URLs even when they point at localhost", () => {
    assert.throws(
      () => assertLocalDatabaseUrl("mysql://root@localhost/lazuli"),
      /local PostgreSQL database/,
    );
  });

  it("rejects remote Postgres URLs", () => {
    assert.throws(
      () => assertLocalDatabaseUrl("postgresql://lazuli:secret@database.example.com/lazuli"),
      /local PostgreSQL database/,
    );
  });
});
