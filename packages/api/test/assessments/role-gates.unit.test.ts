import assert from "node:assert/strict";
import { it } from "node:test";
import { createCaller } from "@lazuli/api";
import { contextFor, TEACHER_FIXTURE } from "../support/support.js";

type Caller = ReturnType<typeof createCaller>;
const invalid = {} as never;
const operations = [
  { name: "byProgress", invoke: (caller: Caller) => caller.assessments.byProgress(invalid) },
  { name: "student", invoke: (caller: Caller) => caller.assessments.student(invalid) },
  { name: "class", invoke: (caller: Caller) => caller.assessments.class(invalid) },
  { name: "classes", invoke: (caller: Caller) => caller.assessments.classes() },
  { name: "save", invoke: (caller: Caller) => caller.assessments.save(invalid) },
  { name: "confirm", invoke: (caller: Caller) => caller.assessments.confirm(invalid) },
];
for (const operation of operations) {
  void it(`assessments.${operation.name} requires an authenticated staff member`, async () => {
    await assert.rejects(operation.invoke(createCaller(contextFor(null))), {
      code: "UNAUTHORIZED",
    });
  });
}
void it("keeps assessment confirmation behind the administrative gate", async () => {
  const teacher = createCaller(contextFor(TEACHER_FIXTURE));
  await assert.rejects(teacher.assessments.confirm(invalid), { code: "FORBIDDEN" });
});
