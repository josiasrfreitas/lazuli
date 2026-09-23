import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { db } from "@lazuli/db";
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
} from "../support/students-list-test-support.js";

const FIXTURE_TOTAL = 13;
const FIXTURE_ACTIVE = 10;
const FIXTURE_INACTIVE = 3;
const PAGE_COUNT = 2;
const EXPANDED_PAGE_SIZE = 25;
const LAST_PAGE = 2;
const LAST_PAGE_ROWS = 3;
const ANA_PERCENT = ANA_PRESENT_COUNT / HELD_SESSIONS;
const BRUNO_PERCENT = BRUNO_PRESENT_COUNT / HELD_SESSIONS;
const BEFORE_EIGHTEENTH_BIRTHDAY_IN_SP = new Date("2044-04-15T02:59:59.999Z");
const START_OF_EIGHTEENTH_BIRTHDAY_IN_SP = new Date("2044-04-15T03:00:00.000Z");

const ANA = "Ana Attend";
const BRUNO = "Bruno Low";
const CARLA = "Carla NoData";
const DAVI = "Davi NoClass";
const ELISA = "Elisa Overdue";
const FELIPE = "Felipe Settled";
const ZOE = "Zoe Birthday";

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
  registerAgeBoundaryTest();
  registerCombinedFiltersTest();
});

function registerCombinedFiltersTest(): void {
  void it("combines situation, class and teacher before total and pagination", async () => {
    const classA = await db.class.findFirstOrThrow({
      where: { internalCode: CLASS_A_CODE },
      select: { id: true, teacherId: true },
    });
    const result = await caller().students.list({
      search: PREFIX,
      situations: ["active"],
      classIds: [classA.id],
      teacherIds: [classA.teacherId],
    });

    assert.deepEqual(
      result.rows.map((row) => row.fullName),
      [fullNameOf(ANA), fullNameOf(BRUNO)],
    );
    assert.equal(result.total, 2);
    assert.equal(result.pageCount, 1);

    const classB = await db.class.findFirstOrThrow({
      where: { internalCode: CLASS_B_CODE },
      select: { teacherId: true },
    });
    const mismatched = await caller().students.list({
      search: PREFIX,
      classIds: [classA.id],
      teacherIds: [classB.teacherId],
    });
    assert.equal(mismatched.total, 0);
    assert.deepEqual(mismatched.rows, []);
  });

  void it("uses São Paulo civil dates for the registration period", async () => {
    await db.student.updateMany({
      where: { fullName: fullNameOf(ANA) },
      data: { createdAt: new Date("2026-03-01T02:59:59.999Z") },
    });
    await db.student.updateMany({
      where: { fullName: fullNameOf(BRUNO) },
      data: { createdAt: new Date("2026-03-01T03:00:00.000Z") },
    });
    const result = await caller().students.list({
      search: PREFIX,
      registeredFrom: "2026-03-01",
      registeredTo: "2026-03-01",
    });

    assert.ok(result.rows.some((row) => row.fullName === fullNameOf(BRUNO)));
    assert.ok(result.rows.every((row) => row.fullName !== fullNameOf(ANA)));
  });
}

function registerCountsAndPaginationTest(): void {
  void it("counts every tab under the current search and paginates by name", async () => {
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
      [fullNameOf("Karina Extra"), fullNameOf("Lucas Extra"), fullNameOf(ZOE)],
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
  void it("groups INACTIVE, SUSPENDED and DROPPED under the inactive tab", async () => {
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
  void it("searches by student name, class code and teacher name", async () => {
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
  void it("derives the semester attendance percent and the below-minimum flag", async () => {
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
  void it("reports the open overdue balance, settled orders and missing orders", async () => {
    const { rows } = await caller().students.list({ search: PREFIX });

    assert.deepEqual(rowFor(rows, ELISA).finance, {
      kind: "overdue",
      overdueCents: OVERDUE_CENTS,
    });
    assert.deepEqual(rowFor(rows, FELIPE).finance, { kind: "upToDate" });
    assert.deepEqual(rowFor(rows, ANA).finance, { kind: "none" });
  });
}

function registerAgeBoundaryTest(): void {
  void it("uses the explicit query date when isMinor flips at the Sao Paulo 18th birthday", async () => {
    const beforeBirthday = await caller(BEFORE_EIGHTEENTH_BIRTHDAY_IN_SP).students.list({
      search: fullNameOf(ZOE),
    });
    const onBirthday = await caller(START_OF_EIGHTEENTH_BIRTHDAY_IN_SP).students.list({
      search: fullNameOf(ZOE),
    });
    const beforeRow = rowFor(beforeBirthday.rows, ZOE);
    const onBirthdayRow = rowFor(onBirthday.rows, ZOE);
    const beforePreview = await caller(BEFORE_EIGHTEENTH_BIRTHDAY_IN_SP).students.preview({
      id: beforeRow.id,
    });
    const onBirthdayPreview = await caller(START_OF_EIGHTEENTH_BIRTHDAY_IN_SP).students.preview({
      id: beforeRow.id,
    });

    assert.equal(beforeRow.isMinor, true);
    assert.equal(onBirthdayRow.isMinor, false);
    assert.equal(beforePreview.isMinor, true);
    assert.equal(onBirthdayPreview.isMinor, false);
  });
}

function rowFor<TRow extends { fullName: string }>(rows: TRow[], suffix: string): TRow {
  const row = rows.find((candidate) => candidate.fullName === fullNameOf(suffix));

  if (row === undefined) {
    throw new Error(`Expected "${suffix}" in the listing.`);
  }

  return row;
}
