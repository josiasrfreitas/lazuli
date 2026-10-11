import assert from "node:assert/strict";
import { it } from "node:test";
import { createCaller } from "@lazuli/api";
import { contextFor, TEACHER_FIXTURE } from "../support/support.js";

type Caller = ReturnType<typeof createCaller>;
const invalid = {} as never;
const operations = [
  { name: "list", invoke: (caller: Caller) => caller.admissions.list(invalid) },
  { name: "byId", invoke: (caller: Caller) => caller.admissions.byId(invalid) },
  { name: "matches", invoke: (caller: Caller) => caller.admissions.matches(invalid) },
  { name: "meetings", invoke: (caller: Caller) => caller.admissions.meetings(invalid) },
  { name: "save", invoke: (caller: Caller) => caller.admissions.save(invalid) },
  { name: "schedule", invoke: (caller: Caller) => caller.admissions.schedule(invalid) },
  { name: "outcome", invoke: (caller: Caller) => caller.admissions.outcome(invalid) },
  { name: "enroll", invoke: (caller: Caller) => caller.admissions.enroll(invalid) },
  { name: "setStatus", invoke: (caller: Caller) => caller.admissions.setStatus(invalid) },
];
for (const operation of operations) {
  void it(`admissions.${operation.name} rejects teachers before reading or changing candidate data`, async () => {
    await assert.rejects(operation.invoke(createCaller(contextFor(TEACHER_FIXTURE))), {
      code: "FORBIDDEN",
    });
  });
  void it(`admissions.${operation.name} rejects anonymous access`, async () => {
    await assert.rejects(operation.invoke(createCaller(contextFor(null))), {
      code: "UNAUTHORIZED",
    });
  });
}
