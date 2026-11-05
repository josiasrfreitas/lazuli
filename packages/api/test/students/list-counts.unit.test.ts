import assert from "node:assert/strict";
import { it } from "node:test";
import { studentListInputSchema } from "@lazuli/validators";
import { listStudents } from "../../src/students/list.js";
import { countStudentsByTab } from "../../src/students/list-query.js";

type Database = Parameters<typeof listStudents>[0]["database"];
const now = new Date("2026-11-03T15:00:00Z");

function fixture() {
  let countQueries = 0;
  let groupedQueries = 0;
  const database = {
    period: { findMany: () => Promise.resolve([]) },
    student: {
      findMany: () => Promise.resolve([]),
      count: () => {
        countQueries += 1;
        return Promise.resolve(2);
      },
      groupBy: () => {
        groupedQueries += 1;
        return Promise.resolve([
          { status: "ACTIVE", _count: { _all: 10 } },
          { status: "INACTIVE", _count: { _all: 1 } },
          { status: "SUSPENDED", _count: { _all: 1 } },
          { status: "DROPPED", _count: { _all: 1 } },
        ]);
      },
    },
  } as object as Database;
  return { database, counts: () => ({ countQueries, groupedQueries }) };
}

void it("gets all tab counts with a single grouped read, including every inactive status", async () => {
  const { database, counts } = fixture();
  assert.deepEqual(await countStudentsByTab({ database, search: undefined }), {
    all: 13,
    active: 10,
    inactive: 3,
  });
  assert.deepEqual(counts(), { countQueries: 0, groupedQueries: 1 });
});

void it("reuses tab totals for unfiltered headers and status pagination", async () => {
  for (const [status, expected] of [
    ["all", 13],
    ["active", 10],
    ["inactive", 3],
  ] as const) {
    const { database, counts } = fixture();
    const result = await listStudents({
      database,
      values: {
        ...studentListInputSchema.parse({ status, situations: [], classIds: [], teacherIds: [] }),
        now,
        staffUserId: "admin",
      },
    });
    assert.equal(result.total, expected, status);
    assert.equal(result.totalStudents, 13, status);
    assert.deepEqual(counts(), { countQueries: 0, groupedQueries: 1 });
  }
});

void it("keeps a separate pagination count whenever additional filters narrow the page", async () => {
  for (const filter of [
    { situations: ["inactive"] },
    { situations: ["active", "inactive"] },
    { classIds: ["00000000-0000-0000-0000-000000000001"] },
    { registeredFrom: "2026-01-01" },
    { registeredTo: "2026-11-03" },
  ]) {
    const { database, counts } = fixture();
    const result = await listStudents({
      database,
      values: {
        ...studentListInputSchema.parse(filter),
        now,
        staffUserId: "admin",
      },
    });
    assert.equal(result.total, 2, JSON.stringify(filter));
    assert.equal(result.totalStudents, 13);
    assert.deepEqual(result.counts, { all: 13, active: 10, inactive: 3 });
    assert.deepEqual(counts(), { countQueries: 1, groupedQueries: 1 });
  }
});
