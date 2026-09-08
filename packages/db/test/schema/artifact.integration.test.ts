import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { config as loadEnvironment } from "dotenv";

import {
  ARTIFACT_REQUESTER_ID,
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

  void it("defaults a requested artifact to an unstarted lifecycle", async () => {
    const { artifact, transactionStartedAt } = await createArtifact(database);

    assert.equal(artifact.startedAt, null);
    assert.equal(artifact.completedAt, null);
    assert.equal(artifact.failedAt, null);
    assert.equal(artifact.requestedAt.getTime(), transactionStartedAt.getTime());
  });
});

async function createArtifact(database: DatabaseClient): Promise<{
  artifact: {
    completedAt: Date | null;
    failedAt: Date | null;
    requestedAt: Date;
    startedAt: Date | null;
  };
  transactionStartedAt: Date;
}> {
  await cleanArtifactSchemaTestData(database);
  await ensureAdminUser(database);

  const [row] = await database.$queryRaw<
    [
      {
        completedAt: Date | null;
        failedAt: Date | null;
        requestedAt: Date;
        startedAt: Date | null;
        transactionStartedAt: Date;
      },
    ]
  >`
    INSERT INTO "generated_artifacts" (
      "id", "updated_at", "kind", "requested_by_id", "file_name"
    ) VALUES (
      gen_random_uuid(), transaction_timestamp(),
      CAST(${ArtifactKind.OVERDUE_RECEIVABLES_CSV} AS "ArtifactKind"),
      ${ARTIFACT_REQUESTER_ID}::uuid, ${`${TEST_PREFIX}overdue.csv`}
    )
    RETURNING
      "requested_at" AS "requestedAt", "started_at" AS "startedAt",
      "completed_at" AS "completedAt", "failed_at" AS "failedAt",
      transaction_timestamp() AS "transactionStartedAt"
  `;
  assert.notEqual(row, undefined);
  const { transactionStartedAt, ...artifact } = row;
  return { artifact, transactionStartedAt };
}
