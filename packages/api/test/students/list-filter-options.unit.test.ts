import assert from "node:assert/strict";
import { it } from "node:test";

import { TRPCError } from "@trpc/server";

import { createCaller, type Context } from "@lazuli/api";

import { ADMIN_FIXTURE } from "../support/support.js";

const CLASS_ID = "00000000-0000-4000-8000-000000000021";
const SEARCH_OVER_LIMIT = 81;
const IDS_OVER_LIMIT = 51;

void it("rejects invalid picker kinds, overlong searches, excessive ids, and unknown fields", async () => {
  const database = {} as Context["db"];
  const caller = createCaller({ db: database, staffUser: ADMIN_FIXTURE });
  const expectBadRequest = (input: object): Promise<void> =>
    assert.rejects(
      caller.students.listFilterOptions(
        input as Parameters<typeof caller.students.listFilterOptions>[0],
      ),
      (error) => error instanceof TRPCError && error.code === "BAD_REQUEST",
    );

  await expectBadRequest({ kind: "student" });
  await expectBadRequest({ kind: "class", search: "x".repeat(SEARCH_OVER_LIMIT) });
  await expectBadRequest({
    kind: "class",
    ids: Array.from({ length: IDS_OVER_LIMIT }, () => CLASS_ID),
  });
  await expectBadRequest({ kind: "class", extra: true });
});
