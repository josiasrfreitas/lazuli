import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { config as loadEnvironment } from "dotenv";

// Mirror prisma.config.ts so the gate works from a local `.env` without
// requiring callers to export DATABASE_URL by hand. CI injects the variable
// directly, in which case this load is a harmless no-op.
loadEnvironment({ path: new URL("../../../.env", import.meta.url), quiet: true });

const { createDbClient } = await import("../src/client.js");

const REQUIRED_MAJOR_VERSION = 16;
const VERSION_NUM_PER_MAJOR = 10_000;

void describe("Postgres integration gate", () => {
  const database = createDbClient();

  void before(async () => {
    await database.$connect();
  });

  void after(async () => {
    await database.$disconnect();
  });

  void it("runs against a real Postgres 16 server", async () => {
    const rows = await database.$queryRaw<
      { server_version_num: string }[]
    >`SELECT current_setting('server_version_num') AS server_version_num`;

    const versionNum = Number(rows[0]?.server_version_num);
    const majorVersion = Math.floor(versionNum / VERSION_NUM_PER_MAJOR);

    assert.equal(
      majorVersion,
      REQUIRED_MAJOR_VERSION,
      `expected Postgres ${REQUIRED_MAJOR_VERSION}, got server_version_num=${rows[0]?.server_version_num}`,
    );
  });
});
