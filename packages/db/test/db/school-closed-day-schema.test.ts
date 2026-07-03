import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { config as loadEnvironment } from "dotenv";

import { databaseIt } from "../support.js";

loadEnvironment({ path: new URL("../../../../.env", import.meta.url), quiet: true });

const { createDbClient } = await import("../../src/client.js");

const TEST_PREFIX = "GRE-28 School Closed Day ";
const ADMIN_ID = "00000000-0000-0000-0000-0000000028ad";

type DatabaseClient = ReturnType<typeof createDbClient>;

void describe("school closed day schema", () => {
  const database = createDbClient();

  void before(async () => {
    await database.$connect();
  });

  void beforeEach(async () => {
    await cleanDatabase(database);
    await ensureAdminUser(database);
  });

  void after(async () => {
    await cleanDatabase(database);
    await database.$disconnect();
  });

  databaseIt("creates and reads a closed day", async () => {
    const created = await database.schoolClosedDay.create({
      data: {
        date: new Date("2030-01-01T00:00:00.000Z"),
        reason: `${TEST_PREFIX}Ano Novo`,
        createdById: ADMIN_ID,
      },
    });

    const found = await database.schoolClosedDay.findUnique({ where: { id: created.id } });

    assert.equal(found?.reason, `${TEST_PREFIX}Ano Novo`);
    assert.equal(found?.createdById, ADMIN_ID);
  });

  databaseIt("rejects duplicate dates", async () => {
    const date = new Date("2030-04-21T00:00:00.000Z");
    await database.schoolClosedDay.create({
      data: { date, reason: `${TEST_PREFIX}Tiradentes`, createdById: ADMIN_ID },
    });

    await assert.rejects(
      database.schoolClosedDay.create({
        data: { date, reason: `${TEST_PREFIX}Duplicado`, createdById: ADMIN_ID },
      }),
      /Unique constraint failed|SchoolClosedDay_date_key/,
    );
  });

  databaseIt("enforces the createdById foreign key", async () => {
    await assert.rejects(
      database.schoolClosedDay.create({
        data: {
          date: new Date("2030-05-01T00:00:00.000Z"),
          reason: `${TEST_PREFIX}Dia do Trabalho`,
          createdById: "00000000-0000-0000-0000-000000002899",
        },
      }),
      /Foreign key constraint violated|SchoolClosedDay_created_by_id_fkey/,
    );
  });
});

async function ensureAdminUser(database: DatabaseClient): Promise<void> {
  await database.user.upsert({
    where: { id: ADMIN_ID },
    create: {
      id: ADMIN_ID,
      email: "gre-28-schema-admin@example.com",
      name: "GRE-28 Schema Admin",
      role: "ADMIN",
      isEnabled: true,
    },
    update: {},
  });
}

async function cleanDatabase(database: DatabaseClient): Promise<void> {
  await database.schoolClosedDay.deleteMany({
    where: { reason: { startsWith: TEST_PREFIX } },
  });
  await database.user.deleteMany({ where: { id: ADMIN_ID } });
}
