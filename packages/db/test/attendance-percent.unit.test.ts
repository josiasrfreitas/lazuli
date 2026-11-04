import assert from "node:assert/strict";
import { it } from "node:test";
import {
  Kysely,
  DummyDriver,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely";
import type { DB } from "../src/generated/kysely/types.js";
import { computeEnrollmentsPercentInWindow } from "../src/attendance-percent.js";

type Input = Parameters<typeof computeEnrollmentsPercentInWindow>[0];
const semester = { startDate: new Date("2026-01-01"), endDate: new Date("2026-06-30") };
const empty = {
  heldSessions: 0,
  presentCount: 0,
  heldMinutes: 0,
  presentMinutes: 0,
  compensatedMinutes: 0,
  missingMinutes: 0,
  percent: null,
  flagged: false,
};
const enrollment = (id: string, classId = "class-a") => ({
  id,
  classId,
  entryDate: semester.startDate,
  exitDate: null,
});

void it("loads attendance once for pages of 10, 25 and 50 enrollments", async () => {
  for (const size of [10, 25, 50]) {
    let queries = 0;
    const database = {
      $kysely: new Kysely<DB>({
        dialect: {
          createDriver: () => new DummyDriver(),
          createAdapter: () => new PostgresAdapter(),
          createIntrospector: (db) => new PostgresIntrospector(db),
          createQueryCompiler: () => new PostgresQueryCompiler(),
        },
        log: (event) => {
          if (event.level === "query") queries += 1;
        },
      }),
    };
    const results = await computeEnrollmentsPercentInWindow({
      database,
      values: {
        semester,
        enrollments: Array.from({ length: size }, (_, i) => enrollment(`enrollment-${i}`)),
      },
    });
    assert.equal(queries, 1, `page size ${size}`);
    assert.equal(results.size, size);
    for (const result of results.values()) assert.deepEqual(result, empty);
  }
});

void it("does not query for empty input or enrollment windows outside the semester", async () => {
  const database = {
    get $kysely(): Input["database"]["$kysely"] {
      throw new Error("No attendance query expected");
    },
  };
  assert.deepEqual(
    await computeEnrollmentsPercentInWindow({ database, values: { semester, enrollments: [] } }),
    new Map(),
  );
  const results = await computeEnrollmentsPercentInWindow({
    database,
    values: {
      semester,
      enrollments: [{ ...enrollment("later"), entryDate: new Date("2026-07-01") }],
    },
  });
  assert.deepEqual(results.get("later"), empty);
});
