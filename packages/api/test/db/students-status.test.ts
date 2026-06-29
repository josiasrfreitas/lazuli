import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import { caller } from "./student-test-support.js";

const TEST_PREFIX = "GRE-23 Student ";
const ADULT_BIRTH_DATE = new Date("1992-05-10T00:00:00.000Z");

let createdLifecycleTables = false;

void describe("students status lifecycle API", () => {
  void before(async () => {
    await db.$connect();
  });

  void after(async () => {
    await dropLifecycleTablesCreatedByTest();
    await cleanDatabase();
    await db.$disconnect();
  });

  registerSetStatusTest();
  registerSuspendedCascadeTest();
  registerDroppedCascadeTest();
});

function registerSetStatusTest(): void {
  databaseIt(
    "updates a student's status through the public status lifecycle mutation",
    async () => {
      const student = await createAdultFixture();

      await caller().students.setStatus({ id: student.id, status: "DROPPED" });

      const profile = await caller().students.byId({ id: student.id });
      assert.equal(profile.contact.status, "DROPPED");
    },
  );
}

function registerSuspendedCascadeTest(): void {
  databaseIt(
    "suspending a student closes active academic lifecycle rows when present",
    async () => {
      await createLifecycleTables();
      const student = await createAdultFixture();
      const closedEnrollmentId = "00000000-0000-0000-0000-0000000000c1";
      const activeEnrollmentId = "00000000-0000-0000-0000-0000000000a1";

      await db.$executeRaw`
      INSERT INTO "Enrollment" ("id", "student_id", "entry_date", "exit_date", "exit_reason")
      VALUES
        (${activeEnrollmentId}::uuid, ${student.id}::uuid, '2026-01-01'::date, NULL, NULL),
        (${closedEnrollmentId}::uuid, ${student.id}::uuid, '2026-01-01'::date, '2026-02-01'::date, 'DROPPED')
    `;
      await db.$executeRaw`
      INSERT INTO "PedagogicalProgress" ("id", "enrollment_id", "start_date", "end_date", "end_reason")
      VALUES
        ('00000000-0000-0000-0000-0000000000b1'::uuid, ${activeEnrollmentId}::uuid, '2026-01-01'::date, NULL, NULL),
        ('00000000-0000-0000-0000-0000000000b2'::uuid, ${closedEnrollmentId}::uuid, '2026-01-01'::date, '2026-02-01'::date, 'DROPPED')
    `;

      await caller().students.setStatus({ id: student.id, status: "SUSPENDED" });

      const enrollments = await db.$queryRaw<
        Array<{ exit_date: Date | null; exit_reason: string | null; id: string }>
      >`
      SELECT "id"::text, "exit_date", "exit_reason"
      FROM "Enrollment"
      WHERE "student_id" = ${student.id}::uuid
      ORDER BY "id"
    `;
      const progress = await db.$queryRaw<
        Array<{ end_date: Date | null; end_reason: string | null; enrollment_id: string }>
      >`
      SELECT "enrollment_id"::text, "end_date", "end_reason"
      FROM "PedagogicalProgress"
      ORDER BY "enrollment_id"
    `;

      assert.equal(enrollments[0]?.exit_reason, "SUSPENDED");
      assert.equal(enrollments[0]?.exit_date instanceof Date, true);
      assert.equal(enrollments[1]?.exit_reason, "DROPPED");
      assert.equal(progress[0]?.end_reason, "SUSPENDED");
      assert.equal(progress[0]?.end_date instanceof Date, true);
      assert.equal(progress[1]?.end_reason, "DROPPED");
    },
  );
}

async function createAdultFixture(): Promise<{ id: string }> {
  return db.student.create({
    data: {
      fullName: `${TEST_PREFIX}Adult`,
      birthDate: ADULT_BIRTH_DATE,
    },
  });
}

function registerDroppedCascadeTest(): void {
  databaseIt("dropping a student closes active academic lifecycle rows as dropped", async () => {
    await createLifecycleTables();
    const student = await createAdultFixture();
    const activeEnrollmentId = "00000000-0000-0000-0000-0000000000d1";

    await db.$executeRaw`
      INSERT INTO "Enrollment" ("id", "student_id", "entry_date", "exit_date", "exit_reason")
      VALUES (${activeEnrollmentId}::uuid, ${student.id}::uuid, '2026-01-01'::date, NULL, NULL)
    `;
    await db.$executeRaw`
      INSERT INTO "PedagogicalProgress" ("id", "enrollment_id", "start_date", "end_date", "end_reason")
      VALUES ('00000000-0000-0000-0000-0000000000d2'::uuid, ${activeEnrollmentId}::uuid, '2026-01-01'::date, NULL, NULL)
    `;

    await caller().students.setStatus({ id: student.id, status: "DROPPED" });

    const [enrollment] = await db.$queryRaw<Array<{ exit_reason: string | null }>>`
      SELECT "exit_reason"
      FROM "Enrollment"
      WHERE "id" = ${activeEnrollmentId}::uuid
    `;
    const [progress] = await db.$queryRaw<Array<{ end_reason: string | null }>>`
      SELECT "end_reason"
      FROM "PedagogicalProgress"
      WHERE "enrollment_id" = ${activeEnrollmentId}::uuid
    `;

    assert.equal(enrollment?.exit_reason, "DROPPED");
    assert.equal(progress?.end_reason, "DROPPED");
  });
}

async function cleanDatabase(): Promise<void> {
  await db.student.deleteMany({ where: { fullName: { startsWith: TEST_PREFIX } } });
}

async function createLifecycleTables(): Promise<void> {
  await (createdLifecycleTables
    ? dropLifecycleTablesCreatedByTest()
    : assertLifecycleTablesDoNotExist());

  await db.$executeRaw`
    CREATE TABLE "Enrollment" (
      "id" uuid PRIMARY KEY,
      "student_id" uuid NOT NULL,
      "entry_date" date NOT NULL,
      "exit_date" date,
      "exit_reason" text
    )
  `;
  await db.$executeRaw`
    CREATE TABLE "PedagogicalProgress" (
      "id" uuid PRIMARY KEY,
      "enrollment_id" uuid NOT NULL,
      "start_date" date NOT NULL,
      "end_date" date,
      "end_reason" text
    )
  `;
  createdLifecycleTables = true;
}

async function assertLifecycleTablesDoNotExist(): Promise<void> {
  const rows = await db.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('Enrollment', 'PedagogicalProgress')
  `;

  assert.deepEqual(
    rows,
    [],
    "GRE-23 uses test-owned lifecycle tables until GRE-26 lands; replace this fixture before running against real lifecycle tables.",
  );
}

async function dropLifecycleTablesCreatedByTest(): Promise<void> {
  if (!createdLifecycleTables) {
    return;
  }

  await db.$executeRaw`DROP TABLE IF EXISTS "PedagogicalProgress"`;
  await db.$executeRaw`DROP TABLE IF EXISTS "Enrollment"`;
  createdLifecycleTables = false;
}
