import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertLocalDatabaseUrl } from "../prisma/reset-url.js";

void describe("database reset URL guard", () => {
  void it("accepts the local Postgres URL used by Docker Compose", () => {
    assert.doesNotThrow(() =>
      assertLocalDatabaseUrl("postgresql://lazuli:lazuli@localhost:5432/lazuli?schema=public"),
    );
  });

  void it("rejects non-Postgres URLs even when they point at localhost", () => {
    assert.throws(
      () => assertLocalDatabaseUrl("mysql://root@localhost/lazuli"),
      /local PostgreSQL database/,
    );
  });

  void it("rejects remote Postgres URLs", () => {
    assert.throws(
      () => assertLocalDatabaseUrl("postgresql://lazuli:secret@database.example.com/lazuli"),
      /local PostgreSQL database/,
    );
  });
});
