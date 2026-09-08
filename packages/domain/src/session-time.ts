const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";
const DATE_ONLY_LENGTH = 10;
const DATE_PART_COUNT = 3;
const TIME_START_INDEX = 11;
const TIME_ONLY_LENGTH = 5;
const TIME_PART_COUNT = 2;
const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MILLISECONDS_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR * MILLISECONDS_PER_MINUTE;
const LOCAL_TIME_PROBE_DAY_RADIUS = 2;
const LOCAL_TIME_PROBE_DAY_OFFSETS = [
  -LOCAL_TIME_PROBE_DAY_RADIUS,
  -1,
  0,
  1,
  LOCAL_TIME_PROBE_DAY_RADIUS,
] as const;

type DateInput = Date | string;

type LocalDateTimeParts = {
  year: number;
  monthIndex: number;
  day: number;
  hour: number;
  minute: number;
};

export type SaoPauloMonthInstantBounds = {
  startInstant: Date;
  endExclusiveInstant: Date;
};

export type SaoPauloMonthDateOnlyUtcBounds = {
  startDateOnlyUtc: Date;
  endExclusiveDateOnlyUtc: Date;
};

export function sessionEndInstant(input: { date: DateInput; endTime: DateInput }): Date {
  return zonedDateTimeToInstant({
    date: toDateOnly(input.date),
    time: toTimeOnly(input.endTime),
    timeZone: SAO_PAULO_TIME_ZONE,
  });
}

/** The `America/Sao_Paulo` wall-clock calendar day for an instant, as `"YYYY-MM-DD"`. */
export function saoPauloDateOnly(instant: Date): string {
  const parts = localDateTimeParts({ instant, timeZone: SAO_PAULO_TIME_ZONE });
  const month = String(parts.monthIndex + 1).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");

  return `${parts.year}-${month}-${day}`;
}

/** Bounds for a Sao Paulo civil month when the stored values are instants. */
export function saoPauloMonthInstantBounds(now: Date): SaoPauloMonthInstantBounds {
  const { year, monthIndex } = saoPauloYearAndMonth(now);

  return {
    startInstant: saoPauloMidnightToInstant({ year, monthIndex, day: 1 }),
    endExclusiveInstant: saoPauloMidnightToInstant({ year, monthIndex: monthIndex + 1, day: 1 }),
  };
}

/** Bounds for a Sao Paulo civil month when Prisma exposes `@db.Date` as UTC-midnight Dates. */
export function saoPauloMonthDateOnlyUtcBounds(now: Date): SaoPauloMonthDateOnlyUtcBounds {
  const { year, monthIndex } = saoPauloYearAndMonth(now);

  return {
    startDateOnlyUtc: new Date(Date.UTC(year, monthIndex, 1)),
    endExclusiveDateOnlyUtc: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

/** Converts a Sao Paulo wall-clock midnight to its UTC instant. */
export function saoPauloMidnightToInstant(input: {
  year: number;
  monthIndex: number;
  day: number;
}): Date {
  const utcGuess = new Date(Date.UTC(input.year, input.monthIndex, input.day));
  return zonedDateTimeToInstant({
    date: utcGuess.toISOString().slice(0, DATE_ONLY_LENGTH),
    time: "00:00",
    timeZone: SAO_PAULO_TIME_ZONE,
  });
}

/**
 * Whether a `@db.Date` target day is at least tomorrow in `America/Sao_Paulo` relative to `now` —
 * the makeup advance-scheduling constraint ("precisa avisar com antecedencia", §4.6). The target is
 * a calendar date compared in UTC; only `now` is resolved through the SP wall clock. `YYYY-MM-DD`
 * strings order chronologically, so a strict `>` means "strictly after the SP current day".
 */
export function isAtLeastTomorrowInSaoPaulo(input: { targetDate: DateInput; now: Date }): boolean {
  return toDateOnly(input.targetDate) > saoPauloDateOnly(input.now);
}

/** Whether a `@db.Date` target day is the current `America/Sao_Paulo` calendar day. */
export function isSameDayInSaoPaulo(input: { targetDate: DateInput; now: Date }): boolean {
  return toDateOnly(input.targetDate) === saoPauloDateOnly(input.now);
}

function zonedDateTimeToInstant(input: { date: string; time: string; timeZone: string }): Date {
  const targetParts = parseLocalDateTime(input);
  const targetMilliseconds = localDateTimeAsUtcMilliseconds(targetParts);
  // Civil-time compatible disambiguation: repeated wall times use the earliest instant, while
  // skipped wall times move forward to the first valid local time after the gap.
  const candidates = candidateInstantsForLocalDateTime({
    targetMilliseconds,
    timeZone: input.timeZone,
  });
  const exactCandidate = earliestExactCandidate({
    candidates,
    targetMilliseconds,
    timeZone: input.timeZone,
  });

  return exactCandidate ?? candidates[0] ?? new Date(targetMilliseconds);
}

function earliestExactCandidate(input: {
  candidates: Date[];
  targetMilliseconds: number;
  timeZone: string;
}): Date | undefined {
  for (const candidate of input.candidates) {
    if (
      localDateTimeEqualsTarget({
        instant: candidate,
        targetMilliseconds: input.targetMilliseconds,
        timeZone: input.timeZone,
      })
    ) {
      return candidate;
    }
  }

  return undefined;
}

function localDateTimeParts(input: { instant: Date; timeZone: string }): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: input.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(input.instant);
  const part = (type: string): string => parts.find((item) => item.type === type)?.value ?? "";

  return {
    year: Number(part("year")),
    monthIndex: Number(part("month")) - 1,
    day: Number(part("day")),
    hour: Number(part("hour")),
    minute: Number(part("minute")),
  };
}

function parseLocalDateTime(input: { date: string; time: string }): LocalDateTimeParts {
  const dateParts = input.date.split("-");
  const timeParts = input.time.split(":");
  const [year, month, day] = dateParts;
  const [hour, minute] = timeParts;
  const hasCompleteDate = dateParts.length === DATE_PART_COUNT;
  const hasCompleteTime = timeParts.length === TIME_PART_COUNT;

  return {
    year: dateTimePartNumber(hasCompleteDate ? year : undefined),
    monthIndex: dateTimePartNumber(hasCompleteDate ? month : undefined) - 1,
    day: dateTimePartNumber(hasCompleteDate ? day : undefined),
    hour: dateTimePartNumber(hasCompleteTime ? hour : undefined),
    minute: dateTimePartNumber(hasCompleteTime ? minute : undefined),
  };
}

function localDateTimeAsUtcMilliseconds(parts: LocalDateTimeParts): number {
  return Date.UTC(parts.year, parts.monthIndex, parts.day, parts.hour, parts.minute);
}

function dateTimePartNumber(value: string | undefined): number {
  if (value === undefined || value === "") {
    return Number.NaN;
  }

  return Number(value);
}

function candidateInstantsForLocalDateTime(input: {
  targetMilliseconds: number;
  timeZone: string;
}): Date[] {
  const offsets = new Set(
    LOCAL_TIME_PROBE_DAY_OFFSETS.map((dayOffset) =>
      timeZoneOffsetMilliseconds({
        instant: new Date(input.targetMilliseconds + dayOffset * MILLISECONDS_PER_DAY),
        timeZone: input.timeZone,
      }),
    ),
  );

  return [...offsets].map(
    (offsetMilliseconds) => new Date(input.targetMilliseconds - offsetMilliseconds),
  );
}

function timeZoneOffsetMilliseconds(input: { instant: Date; timeZone: string }): number {
  return (
    localDateTimeAsUtcMilliseconds(
      localDateTimeParts({ instant: input.instant, timeZone: input.timeZone }),
    ) - input.instant.getTime()
  );
}

function localDateTimeEqualsTarget(input: {
  instant: Date;
  targetMilliseconds: number;
  timeZone: string;
}): boolean {
  return (
    localDateTimeAsUtcMilliseconds(
      localDateTimeParts({ instant: input.instant, timeZone: input.timeZone }),
    ) === input.targetMilliseconds
  );
}

function saoPauloYearAndMonth(now: Date): { year: number; monthIndex: number } {
  const [year, month] = saoPauloDateOnly(now).split("-");

  return { year: Number(year), monthIndex: Number(month) - 1 };
}

function toDateOnly(value: DateInput): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, DATE_ONLY_LENGTH);
  }

  return value.slice(0, DATE_ONLY_LENGTH);
}

function toTimeOnly(value: DateInput): string {
  if (value instanceof Date) {
    return value.toISOString().slice(TIME_START_INDEX, TIME_START_INDEX + TIME_ONLY_LENGTH);
  }

  return value.slice(0, TIME_ONLY_LENGTH);
}
