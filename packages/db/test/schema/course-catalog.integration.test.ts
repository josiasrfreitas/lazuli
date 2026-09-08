import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { config as loadEnvironment } from "dotenv";

import { databaseIt } from "../support.js";

loadEnvironment({ path: new URL("../../../../.env", import.meta.url), quiet: true });

const { createDbClient } = await import("../../src/client.js");

const TEST_KEY_PREFIX = "gre24_schema_";
const TEST_NAME_PREFIX = "GRE-24 Schema ";

type DatabaseClient = ReturnType<typeof createDbClient>;

void describe("course catalog schema", () => {
  const database = createDbClient();

  void before(async () => {
    await database.$connect();
  });

  void beforeEach(async () => {
    await cleanDatabase(database);
  });

  void after(async () => {
    await cleanDatabase(database);
    await database.$disconnect();
  });

  databaseIt("creates and reads product lines, tracks, and stages", () =>
    createAndReadCatalogRows(database),
  );

  databaseIt("allows the same stage code and sequence on different tracks", () =>
    allowSameStageCodeAndSequenceAcrossTracks(database),
  );

  databaseIt("rejects a duplicate stage code within one track", () =>
    rejectDuplicateStageCodeWithinTrack(database),
  );

  databaseIt("rejects a duplicate stage sequence within one track", () =>
    rejectDuplicateStageSequenceWithinTrack(database),
  );

  databaseIt("rejects a duplicate track name within one product line", () =>
    rejectDuplicateTrackNameWithinProductLine(database),
  );
});

async function cleanDatabase(database: DatabaseClient): Promise<void> {
  await database.stage.deleteMany({
    where: {
      track: {
        productLine: { key: { startsWith: TEST_KEY_PREFIX } },
      },
    },
  });
  await database.track.deleteMany({
    where: {
      productLine: { key: { startsWith: TEST_KEY_PREFIX } },
    },
  });
  await database.productLine.deleteMany({
    where: { key: { startsWith: TEST_KEY_PREFIX } },
  });
}

async function createAndReadCatalogRows(database: DatabaseClient): Promise<void> {
  const productLine = await createProductLine({
    database,
    keySuffix: "read",
    nameSuffix: "Read Line",
  });
  const track = await createTrack({
    database,
    nameSuffix: "Read Track",
    productLineId: productLine.id,
  });
  const stage = await database.stage.create({
    data: {
      trackId: track.id,
      name: `${TEST_NAME_PREFIX}Stage`,
      internalCode: "R1",
      sequence: 1,
    },
  });

  const foundStage = await database.stage.findUnique({
    include: { track: { include: { productLine: true } } },
    where: { id: stage.id },
  });

  assert.equal(foundStage?.name, `${TEST_NAME_PREFIX}Stage`);
  assert.equal(foundStage?.track.name, `${TEST_NAME_PREFIX}Read Track`);
  assert.equal(foundStage?.track.productLine.key, `${TEST_KEY_PREFIX}read`);
}

async function allowSameStageCodeAndSequenceAcrossTracks(database: DatabaseClient): Promise<void> {
  const productLine = await createProductLine({
    database,
    keySuffix: "shared",
    nameSuffix: "Shared Line",
  });
  const firstTrack = await createTrack({
    database,
    nameSuffix: "Shared Track A",
    productLineId: productLine.id,
  });
  const secondTrack = await createTrack({
    database,
    nameSuffix: "Shared Track B",
    productLineId: productLine.id,
  });

  await database.stage.createMany({
    data: [
      {
        trackId: firstTrack.id,
        name: `${TEST_NAME_PREFIX}Shared Stage A`,
        internalCode: "SAME",
        sequence: 1,
      },
      {
        trackId: secondTrack.id,
        name: `${TEST_NAME_PREFIX}Shared Stage B`,
        internalCode: "SAME",
        sequence: 1,
      },
    ],
  });

  const sharedStages = await database.stage.findMany({
    where: {
      internalCode: "SAME",
      track: { productLineId: productLine.id },
    },
  });

  assert.equal(sharedStages.length, 2);
}

async function rejectDuplicateStageCodeWithinTrack(database: DatabaseClient): Promise<void> {
  const productLine = await createProductLine({
    database,
    keySuffix: "duplicate_code",
    nameSuffix: "Duplicate Code Line",
  });
  const track = await createTrack({
    database,
    nameSuffix: "Duplicate Code Track",
    productLineId: productLine.id,
  });

  await database.stage.create({
    data: {
      trackId: track.id,
      name: `${TEST_NAME_PREFIX}Original Code`,
      internalCode: "DUP",
      sequence: 1,
    },
  });

  await expectUniqueRejection(
    database.stage.create({
      data: {
        trackId: track.id,
        name: `${TEST_NAME_PREFIX}Duplicate Code`,
        internalCode: "DUP",
        sequence: 2,
      },
    }),
  );
}

async function rejectDuplicateStageSequenceWithinTrack(database: DatabaseClient): Promise<void> {
  const productLine = await createProductLine({
    database,
    keySuffix: "duplicate_sequence",
    nameSuffix: "Duplicate Sequence Line",
  });
  const track = await createTrack({
    database,
    nameSuffix: "Duplicate Sequence Track",
    productLineId: productLine.id,
  });

  await database.stage.create({
    data: {
      trackId: track.id,
      name: `${TEST_NAME_PREFIX}Original Sequence`,
      internalCode: "DS1",
      sequence: 1,
    },
  });

  await expectUniqueRejection(
    database.stage.create({
      data: {
        trackId: track.id,
        name: `${TEST_NAME_PREFIX}Duplicate Sequence`,
        internalCode: "DS2",
        sequence: 1,
      },
    }),
  );
}

async function rejectDuplicateTrackNameWithinProductLine(database: DatabaseClient): Promise<void> {
  const productLine = await createProductLine({
    database,
    keySuffix: "duplicate_track",
    nameSuffix: "Duplicate Track Line",
  });

  await createTrack({
    database,
    nameSuffix: "Duplicate Track",
    productLineId: productLine.id,
  });

  await expectUniqueRejection(
    database.track.create({
      data: {
        productLineId: productLine.id,
        name: `${TEST_NAME_PREFIX}Duplicate Track`,
        status: "ACTIVE",
      },
    }),
  );
}

async function createProductLine({
  database,
  keySuffix,
  nameSuffix,
}: {
  database: DatabaseClient;
  keySuffix: string;
  nameSuffix: string;
}): Promise<{ id: string }> {
  return database.productLine.create({
    data: {
      key: `${TEST_KEY_PREFIX}${keySuffix}`,
      name: `${TEST_NAME_PREFIX}${nameSuffix}`,
      status: "ACTIVE",
    },
    select: { id: true },
  });
}

async function createTrack({
  database,
  productLineId,
  nameSuffix,
}: {
  database: DatabaseClient;
  productLineId: string;
  nameSuffix: string;
}): Promise<{ id: string }> {
  return database.track.create({
    data: {
      productLineId,
      name: `${TEST_NAME_PREFIX}${nameSuffix}`,
      status: "ACTIVE",
    },
    select: { id: true },
  });
}

async function expectUniqueRejection(action: Promise<unknown>): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(isPrismaError(error));
    assert.equal(error.code, "P2002");
    return true;
  });
}

function isPrismaError(error: unknown): error is Error & { code: string } {
  return error instanceof Error && "code" in error;
}
