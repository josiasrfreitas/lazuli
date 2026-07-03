const TIME_EPOCH_PREFIX = "1970-01-01T";
const TIME_SLICE_START = 11;
const TIME_SLICE_END = 16;

/** Converts HH:mm input into the Date shape Prisma expects for @db.Time columns. */
export function timeStringToDate(time: string): Date {
  return new Date(`${TIME_EPOCH_PREFIX}${time}:00.000Z`);
}

/** Reads an @db.Time column back to HH:mm for Portal name derivation. */
export function dateToTimeString(value: Date): string {
  return value.toISOString().slice(TIME_SLICE_START, TIME_SLICE_END);
}
