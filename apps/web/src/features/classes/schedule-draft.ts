import { timeOfDaySchema } from "@lazuli/validators";
import type { ClassDraft } from "./create-model";

type Slot = ClassDraft["slots"][number];
type ScheduleDraft = { slots: Slot[]; autoFillUsed: boolean };
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const TIME_PART_WIDTH = 2;

function followingHour(slot: Slot): Slot | null {
  if (
    !slot.weekday ||
    !timeOfDaySchema.safeParse(slot.startTime).success ||
    !timeOfDaySchema.safeParse(slot.endTime).success ||
    slot.startTime >= slot.endTime
  )
    return null;
  const [hour, minute] = slot.endTime.split(":").map(Number);
  const end = (hour ?? 0) * MINUTES_PER_HOUR + (minute ?? 0) + MINUTES_PER_HOUR;
  if (end >= HOURS_PER_DAY * MINUTES_PER_HOUR) return null;
  const endTime = [Math.floor(end / MINUTES_PER_HOUR), end % MINUTES_PER_HOUR]
    .map((part) => String(part).padStart(TIME_PART_WIDTH, "0"))
    .join(":");
  return { weekday: slot.weekday, startTime: slot.endTime, endTime };
}

/** Suggest the following hour once, after either row is first completed. */
export function updateScheduleDraft({
  slots,
  index,
  value,
  autoFillUsed,
}: ScheduleDraft & {
  index: number;
  value: Slot;
}): ScheduleDraft {
  const updated = slots.map((slot, position) => (position === index ? value : slot));
  if (autoFillUsed) return { slots: updated, autoFillUsed };
  const suggestion = followingHour(value);
  if (!suggestion) return { slots: updated, autoFillUsed };
  const target = updated.findIndex(
    (slot, position) =>
      position !== index &&
      !slot.startTime &&
      !slot.endTime &&
      (!slot.weekday || slot.weekday === value.weekday),
  );
  return {
    slots: updated.map((slot, position) => (position === target ? suggestion : slot)),
    autoFillUsed: true,
  };
}
