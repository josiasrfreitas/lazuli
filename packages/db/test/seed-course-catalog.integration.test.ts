import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { config as loadEnvironment } from "dotenv";

import { databaseIt } from "./support/support.js";

loadEnvironment({ path: new URL("../../../.env", import.meta.url), quiet: true });

const { createDbClient } = await import("../src/client.js");
const { COURSE_CATALOG, seedCourseCatalog } = await import("../src/seed-course-catalog.js");

const PRODUCT_LINE_KEYS = COURSE_CATALOG.map((productLine) => productLine.key);
const EXPECTED_TRACK_COUNT = 7;
const EXPECTED_STAGE_COUNT = 42;
const ENGLISH_MAIN_FINAL_SEQUENCE = 7;
const INFANTIL_FINAL_SEQUENCE = 13;
const TEENS_UPPER_INTERMEDIATE_SEQUENCE = 5;
const TEENS_CONNECT_FINAL_SEQUENCE = 4;

type DatabaseClient = ReturnType<typeof createDbClient>;

void describe("course catalog seed", () => {
  const database = createDbClient();

  void before(async () => {
    await database.$connect();
    await cleanSeededCatalog(database);
  });

  void after(async () => {
    await cleanSeededCatalog(database);
    await database.$disconnect();
  });

  databaseIt("seeds product lines, tracks, stages, statuses, and representative ordering", () =>
    seedAndVerifyCourseCatalog(database),
  );

  databaseIt("is idempotent when rerun", () => verifyIdempotentRerun(database));
});

async function cleanSeededCatalog(database: DatabaseClient): Promise<void> {
  await database.stage.deleteMany({
    where: {
      track: {
        productLine: { key: { in: [...PRODUCT_LINE_KEYS] } },
      },
    },
  });
  await database.track.deleteMany({
    where: {
      productLine: { key: { in: [...PRODUCT_LINE_KEYS] } },
    },
  });
  await database.productLine.deleteMany({
    where: { key: { in: [...PRODUCT_LINE_KEYS] } },
  });
}

async function seedAndVerifyCourseCatalog(database: DatabaseClient): Promise<void> {
  await seedCourseCatalog(database);

  await expectCatalogCounts(database);
  await expectProductLineStatuses(database);
  await expectTrackStatuses(database);
  await expectRepresentativeStageOrdering(database);
}

async function verifyIdempotentRerun(database: DatabaseClient): Promise<void> {
  await seedCourseCatalog(database);
  await seedCourseCatalog(database);

  await expectCatalogCounts(database);
}

async function expectCatalogCounts(database: DatabaseClient): Promise<void> {
  const productLineCount = await database.productLine.count({
    where: { key: { in: [...PRODUCT_LINE_KEYS] } },
  });
  const trackCount = await database.track.count({
    where: { productLine: { key: { in: [...PRODUCT_LINE_KEYS] } } },
  });
  const stageCount = await database.stage.count({
    where: { track: { productLine: { key: { in: [...PRODUCT_LINE_KEYS] } } } },
  });

  assert.equal(productLineCount, PRODUCT_LINE_KEYS.length);
  assert.equal(trackCount, EXPECTED_TRACK_COUNT);
  assert.equal(stageCount, EXPECTED_STAGE_COUNT);
}

async function expectProductLineStatuses(database: DatabaseClient): Promise<void> {
  const productLines = await database.productLine.findMany({
    orderBy: { key: "asc" },
    select: { key: true, status: true },
    where: { key: { in: [...PRODUCT_LINE_KEYS] } },
  });

  assert.deepEqual(
    Object.fromEntries(productLines.map((productLine) => [productLine.key, productLine.status])),
    {
      adult: "ACTIVE",
      kids: "ACTIVE",
      teens: "LEGACY",
      teens_connect: "ACTIVE",
      teenstation: "LEGACY",
    },
  );
}

async function expectTrackStatuses(database: DatabaseClient): Promise<void> {
  const tracks = await database.track.findMany({
    orderBy: { name: "asc" },
    select: { name: true, status: true },
    where: { productLine: { key: { in: [...PRODUCT_LINE_KEYS] } } },
  });

  assert.deepEqual(Object.fromEntries(tracks.map((track) => [track.name, track.status])), {
    "Adultos / English Main": "ACTIVE",
    "Adultos / Espanol": "ACTIVE",
    "Adultos / Speed": "ACTIVE",
    Infantil: "ACTIVE",
    "Teens Connect": "ACTIVE",
    "Teens Legacy": "LEGACY",
    "Teenstation Legacy": "LEGACY",
  });
}

async function expectRepresentativeStageOrdering(database: DatabaseClient): Promise<void> {
  await expectStageSequence({
    database,
    internalCode: "E1",
    sequence: 1,
    trackName: "Adultos / English Main",
  });
  await expectStageSequence({
    database,
    internalCode: "FIF",
    sequence: ENGLISH_MAIN_FINAL_SEQUENCE,
    trackName: "Adultos / English Main",
  });
  await expectStageSequence({
    database,
    internalCode: "FAT",
    sequence: INFANTIL_FINAL_SEQUENCE,
    trackName: "Infantil",
  });
  await expectStageSequence({
    database,
    internalCode: "TUI",
    sequence: TEENS_UPPER_INTERMEDIATE_SEQUENCE,
    trackName: "Teens Legacy",
  });
  await expectStageSequence({
    database,
    internalCode: "C4",
    sequence: TEENS_CONNECT_FINAL_SEQUENCE,
    trackName: "Teens Connect",
  });
}

async function expectStageSequence({
  database,
  trackName,
  internalCode,
  sequence,
}: {
  database: DatabaseClient;
  trackName: string;
  internalCode: string;
  sequence: number;
}): Promise<void> {
  const stage = await database.stage.findFirst({
    where: {
      internalCode,
      track: {
        name: trackName,
        productLine: { key: { in: [...PRODUCT_LINE_KEYS] } },
      },
    },
  });

  assert.equal(stage?.sequence, sequence);
}
