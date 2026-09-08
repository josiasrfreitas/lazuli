import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { TRPCError } from "@trpc/server";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  caller,
  cleanStudentsListFixture,
  fullNameOf,
  PREFIX,
  seedStudentsListFixture,
} from "./students-list-test-support.js";

const ANA = "Ana Attend";
const DAVI = "Davi NoClass";

void describe("students.preview", { concurrency: 1 }, () => {
  void before(async () => {
    await db.$connect();
    await cleanStudentsListFixture();
    await seedStudentsListFixture();
  });
  void after(async () => {
    await cleanStudentsListFixture();
    await db.$disconnect();
  });

  registerSameShapeTest();
  registerNotFoundTest();
});

function registerSameShapeTest(): void {
  databaseIt("returns the same row the listing renders, found by id alone", async () => {
    const list = await caller().students.list({ search: PREFIX });
    const names = [fullNameOf(ANA), fullNameOf(DAVI)];

    for (const name of names) {
      const row = list.rows.find((candidate) => candidate.fullName === name);
      assert.ok(row, `expected ${name} on the first page of the fixture listing`);

      assert.deepEqual(await caller().students.preview({ id: row.id }), row);
    }
  });
}

function registerNotFoundTest(): void {
  databaseIt("rejects an unknown student id with NOT_FOUND", async () => {
    await assert.rejects(
      caller().students.preview({ id: randomUUID() }),
      (error: unknown) => error instanceof TRPCError && error.code === "NOT_FOUND",
    );
  });
}
