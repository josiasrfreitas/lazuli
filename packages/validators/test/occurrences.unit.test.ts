import assert from "node:assert/strict";
import { it } from "node:test";
import { occurrenceCreateSchema } from "../src/occurrences.js";
const base = {
  studentId: "00000000-0000-4000-8000-000000000001",
  title: "Fora de Aula",
  category: "OTHER",
  account: "Discussão durante o evento.",
};
void it("requires a real date, valid clock time and description outside class", () => {
  const outside = { ...base, occurredOn: "2026-11-12", occurredTime: "23:59" };
  assert.equal(occurrenceCreateSchema.parse(outside).occurredTime, "23:59");
  for (const invalid of [
    { ...outside, occurredOn: undefined },
    { ...outside, occurredTime: undefined },
    { ...outside, occurredOn: "2026-02-30" },
    { ...outside, occurredTime: "24:00" },
    { ...outside, account: "  " },
    { ...outside, classSessionId: base.studentId },
  ])
    assert.equal(occurrenceCreateSchema.safeParse(invalid).success, false);
});
void it("preserves lesson-linked occurrence input", () => {
  assert.equal(
    occurrenceCreateSchema.parse({ ...base, classSessionId: base.studentId }).classSessionId,
    base.studentId,
  );
  assert.equal(occurrenceCreateSchema.safeParse(base).success, false);
});
