import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";
import { DEFAULT_STUDENT_PAGE_SIZE } from "@lazuli/validators";

import {
  ANA_PRESENT_COUNT,
  BRUNO_PRESENT_COUNT,
  CLASS_A_CODE,
  CLASS_A_SCHEDULE_LABEL,
  CLASS_B_CODE,
  CLASS_B_SCHEDULE_LABEL,
  HELD_SESSIONS,
  OVERDUE_CENTS,
  PREFIX,
  STUDENT_SEEDS,
  TEACHER_A_NAME,
  TEACHER_B_NAME,
  caller,
  cleanStudentsListFixture,
  fullNameOf,
  seedStudentsListFixture,
} from "./students-list-test-support.js";

const FIXTURE_TOTAL = 12;
const FIXTURE_ACTIVE = 9;
const FIXTURE_INACTIVE = 3;
const PAGE_COUNT = 2;
const EXPANDED_PAGE_SIZE = 25;
const LAST_PAGE = 2;
const LAST_PAGE_ROWS = 2;
const ANA_PERCENT = ANA_PRESENT_COUNT / HELD_SESSIONS;
const BRUNO_PERCENT = BRUNO_PRESENT_COUNT / HELD_SESSIONS;

const ANA = "Ana Attend";
const BRUNO = "Bruno Low";
const CARLA = "Carla NoData";
const DAVI = "Davi NoClass";
const ELISA = "Elisa Overdue";
const FELIPE = "Felipe Settled";

void describe("students.list", { concurrency: 1 }, () => {
  void before(async () => {
    await db.$connect();
    await cleanStudentsListFixture();
    await seedStudentsListFixture();
  });
  void after(async () => {
    await cleanStudentsListFixture();
    await db.$disconnect();
  });

  registerCountsAndPaginationTest();
  registerStatusFilterTest();
  registerSearchTest();
  registerAttendanceTest();
  registerFinanceTest();
});

function registerCountsAndPaginationTest(): void {
  databaseIt("counts every tab under the current search and paginates by name", async () => {
    const firstPage = await caller().students.list({ search: PREFIX });

    assert.deepEqual(firstPage.counts, {
      all: FIXTURE_TOTAL,
      active: FIXTURE_ACTIVE,
      inactive: FIXTURE_INACTIVE,
    });
    assert.equal(firstPage.pageCount, PAGE_COUNT);
    assert.equal(firstPage.pageSize, DEFAULT_STUDENT_PAGE_SIZE);
    assert.equal(firstPage.total, FIXTURE_TOTAL);
    assert.deepEqual(
      firstPage.rows.map((row) => row.fullName),
      STUDENT_SEEDS.slice(0, firstPage.rows.length).map((seed) => fullNameOf(seed.suffix)),
    );
    assert.ok(firstPage.totalStudents >= FIXTURE_TOTAL);
    assert.ok(firstPage.activeClasses >= PAGE_COUNT);

    const lastPage = await caller().students.list({ search: PREFIX, page: LAST_PAGE });

    assert.equal(lastPage.page, LAST_PAGE);
    assert.equal(lastPage.rows.length, LAST_PAGE_ROWS);
    assert.deepEqual(
      lastPage.rows.map((row) => row.fullName),
      [fullNameOf("Karina Extra"), fullNameOf("Lucas Extra")],
    );

    const expandedPage = await caller().students.list({
      search: PREFIX,
      pageSize: EXPANDED_PAGE_SIZE,
    });

    assert.equal(expandedPage.pageCount, 1);
    assert.equal(expandedPage.pageSize, EXPANDED_PAGE_SIZE);
    assert.equal(expandedPage.rows.length, FIXTURE_TOTAL);
  });
}

function registerStatusFilterTest(): void {
  databaseIt("groups INACTIVE, SUSPENDED and DROPPED under the inactive tab", async () => {
    const inactive = await caller().students.list({ search: PREFIX, status: "inactive" });
    const active = await caller().students.list({ search: PREFIX, status: "active" });

    assert.deepEqual(
      inactive.rows.map((row) => row.status),
      ["SUSPENDED", "DROPPED", "INACTIVE"],
    );
    assert.equal(inactive.pageCount, 1);
    assert.equal(active.rows.length, active.counts.active);
    assert.ok(active.rows.every((row) => row.status === "ACTIVE"));
  });
}

function registerSearchTest(): void {
  databaseIt("searches by student name, class code and teacher name", async () => {
    const results = await Promise.all(
      [CARLA, CLASS_B_CODE, TEACHER_B_NAME].map((search) => caller().students.list({ search })),
    );

    for (const result of results) {
      assert.deepEqual(
        result.rows.map((row) => row.fullName),
        [fullNameOf(CARLA)],
      );
    }

    const byOtherTeacher = await caller().students.list({ search: TEACHER_A_NAME });

    assert.deepEqual(
      byOtherTeacher.rows.map((row) => row.fullName),
      [fullNameOf(ANA), fullNameOf(BRUNO)],
    );
  });
}

function registerAttendanceTest(): void {
  databaseIt("derives the semester attendance percent and the below-minimum flag", async () => {
    const { rows } = await caller().students.list({ search: PREFIX });
    const ana = rowFor(rows, ANA);
    const carla = rowFor(rows, CARLA);
    const davi = rowFor(rows, DAVI);

    assert.deepEqual(ana.attendance, { percent: ANA_PERCENT, flagged: false });
    assert.deepEqual(rowFor(rows, BRUNO).attendance, { percent: BRUNO_PERCENT, flagged: true });
    assert.deepEqual(carla.attendance, { percent: null, flagged: false });
    assert.deepEqual(davi.attendance, { percent: null, flagged: false });

    assert.equal(ana.enrollment?.classCode, CLASS_A_CODE);
    assert.equal(ana.enrollment?.scheduleLabel, CLASS_A_SCHEDULE_LABEL);
    assert.equal(ana.enrollment?.teacherName, TEACHER_A_NAME);
    assert.equal(carla.enrollment?.scheduleLabel, CLASS_B_SCHEDULE_LABEL);
    assert.equal(davi.enrollment, null);
    assert.equal(davi.isMinor, true);
    assert.equal(ana.isMinor, false);
  });
}

function registerFinanceTest(): void {
  databaseIt("reports the open overdue balance, settled orders and missing orders", async () => {
    const { rows } = await caller().students.list({ search: PREFIX });

    assert.deepEqual(rowFor(rows, ELISA).finance, {
      kind: "overdue",
      overdueCents: OVERDUE_CENTS,
    });
    assert.deepEqual(rowFor(rows, FELIPE).finance, { kind: "upToDate" });
    assert.deepEqual(rowFor(rows, ANA).finance, { kind: "none" });
  });
}

function rowFor<TRow extends { fullName: string }>(rows: TRow[], suffix: string): TRow {
  const row = rows.find((candidate) => candidate.fullName === fullNameOf(suffix));

  if (row === undefined) {
    throw new Error(`Expected "${suffix}" in the listing.`);
  }

  return row;
}
