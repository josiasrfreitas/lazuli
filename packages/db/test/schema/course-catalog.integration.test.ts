import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { config as loadEnvironment } from "dotenv";

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

  registerSchemaTest1(database);

  registerSchemaTest2(database);

  registerSchemaTest3(database);

  registerSchemaTest4(database);

  registerSchemaTest5(database);
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

async function createCatalogRowsWithDefaultStatuses(database: DatabaseClient): Promise<{
  productLine: string;
  track: string;
}> {
  const productLine = await database.productLine.create({
    data: {
      key: `${TEST_KEY_PREFIX}defaults`,
      name: `${TEST_NAME_PREFIX}Defaults Line`,
    },
  });
  const track = await database.track.create({
    data: {
      productLineId: productLine.id,
      name: `${TEST_NAME_PREFIX}Defaults Track`,
    },
  });

  return { productLine: productLine.status, track: track.status };
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

async function expectUniqueRejection(action: Promise<unknown>): Promise<string> {
  let observedCode: string | undefined;
  await assert.rejects(action, (error: unknown) => {
    assert.ok(isPrismaError(error));
    observedCode = error.code;
    assert.equal(error.code, "P2002");
    return true;
  });
  assert.notEqual(observedCode, undefined);
  return observedCode as string;
}

function isPrismaError(error: unknown): error is Error & { code: string } {
  return error instanceof Error && "code" in error;
}

function registerSchemaTest1(database: DatabaseClient): void {
  void it("defaults new product lines and tracks to active", async () => {
    const statuses = await createCatalogRowsWithDefaultStatuses(database);

    assert.deepEqual(statuses, { productLine: "ACTIVE", track: "ACTIVE" });
  });
}

function registerSchemaTest2(database: DatabaseClient): void {
  void it("allows the same stage code and sequence on different tracks", async () => {
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
  });
}

function registerSchemaTest3(database: DatabaseClient): void {
  void it("rejects a duplicate stage code within one track", async () => {
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

    assert.equal(
      await expectUniqueRejection(
        database.stage.create({
          data: {
            trackId: track.id,
            name: `${TEST_NAME_PREFIX}Duplicate Code`,
            internalCode: "DUP",
            sequence: 2,
          },
        }),
      ),
      "P2002",
    );
  });
}

function registerSchemaTest4(database: DatabaseClient): void {
  void it("rejects a duplicate stage sequence within one track", async () => {
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

    assert.equal(
      await expectUniqueRejection(
        database.stage.create({
          data: {
            trackId: track.id,
            name: `${TEST_NAME_PREFIX}Duplicate Sequence`,
            internalCode: "DS2",
            sequence: 1,
          },
        }),
      ),
      "P2002",
    );
  });
}

function registerSchemaTest5(database: DatabaseClient): void {
  void it("rejects a duplicate track name within one product line", async () => {
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

    assert.equal(
      await expectUniqueRejection(
        database.track.create({
          data: {
            productLineId: productLine.id,
            name: `${TEST_NAME_PREFIX}Duplicate Track`,
            status: "ACTIVE",
          },
        }),
      ),
      "P2002",
    );
  });
}
