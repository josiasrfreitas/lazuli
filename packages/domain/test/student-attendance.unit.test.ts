import assert from "node:assert/strict";
import { it } from "node:test";
import { matchAttendanceNames, attendanceDistance } from "../src/student-attendance.js";
void it("selects only an unambiguous exact name and keeps partial family matches explicit", () => {
  const people = [
    { id: "ana", name: "Ana Beatriz Martins Andrade", phone: null },
    { id: "bruno", name: "Bruno Martins Andrade", phone: null },
    { id: "cecilia", name: "Cecília de Sá", phone: null },
  ];
  assert.equal(matchAttendanceNames(people, "  cecilia DE sa ").exactId, "cecilia");
  const partial = matchAttendanceNames(people, "Martins Andrade");
  assert.deepEqual(
    partial.options.map((row) => row.id),
    ["ana", "bruno"],
  );
  assert.equal(partial.exactId, null);
  assert.equal(matchAttendanceNames(people, "Cecila").options.length, 0);
});
void it("never chooses a homonym by order and exposes only distinct phone suffixes", () => {
  const people = [
    { id: "a", name: "Ana Silva", phone: "(82) 99999-1234" },
    { id: "b", name: "Ana Silva", phone: "(82) 98888-5678" },
  ];
  const result = matchAttendanceNames(people, "Ana Silva");
  assert.equal(result.exactId, null);
  assert.deepEqual(
    result.options.map((row) => [row.phoneHint, row.manualRequired]),
    [
      ["1234", false],
      ["5678", false],
    ],
  );
  assert.doesNotMatch(JSON.stringify(result), /99999|98888/u);
  assert.deepEqual(
    matchAttendanceNames(
      people.map((row) => ({ ...row, phone: null })),
      "Ana Silva",
    ).options.map((row) => row.manualRequired),
    [true, true],
  );
  assert.deepEqual(
    matchAttendanceNames(
      people.map((row) => ({ ...row, phone: "999991234" })),
      "Ana Silva",
    ).options.map((row) => row.manualRequired),
    [true, true],
  );
});
void it("requires refinement for broad searches and computes distance without deciding attendance", () => {
  const people = Array.from({ length: 9 }, (_, i) => ({
    id: String(i),
    name: `Ana Pessoa ${i}`,
    phone: null,
  }));
  assert.deepEqual(matchAttendanceNames(people, "Ana"), {
    options: [],
    exactId: null,
    refine: true,
  });
  assert.deepEqual(matchAttendanceNames(people, "An").options, []);
  assert.equal(
    attendanceDistance({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.001 }),
    111,
  );
});
