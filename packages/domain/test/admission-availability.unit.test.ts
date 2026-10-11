import assert from "node:assert/strict";
import { it } from "node:test";
import { availabilityCovers, availabilityIsCurrent } from "../src/admission-availability.js";

void it("requires availability for every recurring class meeting", () => {
  const windows = [{ weekday: "MONDAY", startTime: "17:00", endTime: "20:00" }];
  assert.equal(
    availabilityCovers(windows, [{ weekday: "MONDAY", startTime: "18:00", endTime: "19:00" }]),
    true,
  );
  assert.equal(
    availabilityCovers(windows, [
      { weekday: "MONDAY", startTime: "18:00", endTime: "19:00" },
      { weekday: "WEDNESDAY", startTime: "18:00", endTime: "19:00" },
    ]),
    false,
  );
});
void it("joins adjoining windows but rejects even a one-minute gap", () => {
  const meeting = [{ weekday: "SATURDAY", startTime: "09:00", endTime: "11:00" }];
  assert.equal(
    availabilityCovers(
      [
        { weekday: "SATURDAY", startTime: "09:00", endTime: "10:00" },
        { weekday: "SATURDAY", startTime: "10:00", endTime: "11:00" },
      ],
      meeting,
    ),
    true,
  );
  assert.equal(
    availabilityCovers(
      [
        { weekday: "SATURDAY", startTime: "09:00", endTime: "10:00" },
        { weekday: "SATURDAY", startTime: "10:01", endTime: "11:00" },
      ],
      meeting,
    ),
    false,
  );
  assert.equal(availabilityCovers([], meeting), false);
  assert.equal(availabilityCovers([], []), false);
});
void it("availability remains valid on its expiry day and expires the next day", () => {
  assert.equal(availabilityIsCurrent("2026-10-31", "2026-10-31"), true);
  assert.equal(availabilityIsCurrent("2026-10-31", "2026-11-01"), false);
});
