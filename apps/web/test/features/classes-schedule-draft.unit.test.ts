import assert from "node:assert/strict";
import { it } from "node:test";
import { emptyClassSlot } from "../../src/features/classes/create-model.js";
import { updateScheduleDraft } from "../../src/features/classes/schedule-draft.js";

const saturday = { weekday: "SATURDAY", startTime: "08:00", endTime: "09:00" } as const;

for (const index of [0, 1]) {
  void it(`fills the other row after row ${index + 1} is completed, only once`, () => {
    const initial = updateScheduleDraft({
      slots: [emptyClassSlot(), emptyClassSlot()],
      index,
      value: saturday,
      autoFillUsed: false,
    });
    assert.deepEqual(initial.slots[1 - index], {
      weekday: "SATURDAY",
      startTime: "09:00",
      endTime: "10:00",
    });
    const edited = updateScheduleDraft({
      ...initial,
      index,
      value: { ...saturday, endTime: "09:30" },
    });
    assert.deepEqual(edited.slots[1 - index], {
      weekday: "SATURDAY",
      startTime: "09:00",
      endTime: "10:00",
    });
    assert.equal(edited.slots[index]?.endTime, "09:30");
  });
}

void it("waits for a valid complete time range before suggesting", () => {
  for (const value of [
    { ...saturday, endTime: "09:" },
    { ...saturday, startTime: "10:00" },
    { ...saturday, weekday: "" as const },
    { ...saturday, startTime: "22:00", endTime: "23:00" },
  ]) {
    const result = updateScheduleDraft({
      slots: [emptyClassSlot(), emptyClassSlot()],
      index: 0,
      value,
      autoFillUsed: false,
    });
    assert.deepEqual(result.slots[1], emptyClassSlot());
    assert.equal(result.autoFillUsed, false);
  }
});

void it("preserves manually entered values in the other row", () => {
  const manual = { weekday: "TUESDAY", startTime: "19:00", endTime: "20:00" } as const;
  const result = updateScheduleDraft({
    slots: [emptyClassSlot(), manual],
    index: 0,
    value: saturday,
    autoFillUsed: false,
  });
  assert.deepEqual(result.slots, [saturday, manual]);
  assert.equal(result.autoFillUsed, true);
});

for (const endTime of ["09:30", "10:00"]) {
  void it(`keeps an otherwise valid meeting ending at ${endTime} within the weekly limit`, () => {
    const meeting = { ...saturday, endTime };
    const result = updateScheduleDraft({
      slots: [emptyClassSlot(), emptyClassSlot()],
      index: 0,
      value: meeting,
      autoFillUsed: false,
    });
    assert.deepEqual(result.slots, [meeting, emptyClassSlot()]);
    assert.equal(result.autoFillUsed, true);
  });
}
