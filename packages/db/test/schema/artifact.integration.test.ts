import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { config as loadEnvironment } from "dotenv";

import { databaseIt } from "../support/support.js";
import {
  ADMIN_USER_ID,
  cleanArtifactSchemaTestData,
  ensureAdminUser,
  TEST_PREFIX,
} from "../support/artifact-schema-support.js";

loadEnvironment({ path: new URL("../../../../.env", import.meta.url), quiet: true });

const { createDbClient } = await import("../../src/client.js");
const { ArtifactKind } = await import("../../src/index.js");

type DatabaseClient = ReturnType<typeof createDbClient>;

void describe("generated artifact schema", () => {
  const database = createDbClient();

  void before(async () => {
    await database.$connect();
  });

  void after(async () => {
    await cleanArtifactSchemaTestData(database);
    await database.$disconnect();
  });

  databaseIt("creates and reads a queued artifact with lifecycle timestamps", () =>
    createAndReadArtifact(database),
  );
});

async function createAndReadArtifact(database: DatabaseClient): Promise<void> {
  await cleanArtifactSchemaTestData(database);
  await ensureAdminUser(database);

  const requestedAt = new Date("2026-07-01T10:00:00.000Z");
  const startedAt = new Date("2026-07-01T10:00:05.000Z");
  const completedAt = new Date("2026-07-01T10:00:30.000Z");

  const created = await database.generatedArtifact.create({
    data: {
      kind: ArtifactKind.OVERDUE_RECEIVABLES_CSV,
      requestedById: ADMIN_USER_ID,
      fileName: `${TEST_PREFIX}overdue.csv`,
      requestedAt,
      startedAt,
      completedAt,
    },
  });

  const found = await database.generatedArtifact.findUniqueOrThrow({ where: { id: created.id } });

  assert.equal(found.kind, ArtifactKind.OVERDUE_RECEIVABLES_CSV);
  assert.equal(found.requestedById, ADMIN_USER_ID);
  assert.equal(found.requestedAt.toISOString(), requestedAt.toISOString());
  assert.equal(found.startedAt?.toISOString(), startedAt.toISOString());
  assert.equal(found.completedAt?.toISOString(), completedAt.toISOString());
  assert.equal(found.failedAt, null);
}
