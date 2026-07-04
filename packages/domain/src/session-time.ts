const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";
const DATE_ONLY_LENGTH = 10;
const TIME_START_INDEX = 11;
const TIME_ONLY_LENGTH = 5;

type DateInput = Date | string;

export function sessionEndInstant(input: { date: DateInput; endTime: DateInput }): Date {
  return zonedDateTimeToInstant({
    date: toDateOnly(input.date),
    time: toTimeOnly(input.endTime),
    timeZone: SAO_PAULO_TIME_ZONE,
  });
}

function zonedDateTimeToInstant(input: { date: string; time: string; timeZone: string }): Date {
  const utcGuess = new Date(`${input.date}T${input.time}:00.000Z`);
  const localParts = localDateTimeParts({ instant: utcGuess, timeZone: input.timeZone });
  const localAsUtc = Date.UTC(
    localParts.year,
    localParts.monthIndex,
    localParts.day,
    localParts.hour,
    localParts.minute,
  );
  const offsetMilliseconds = localAsUtc - utcGuess.getTime();

  return new Date(utcGuess.getTime() - offsetMilliseconds);
}

function localDateTimeParts(input: { instant: Date; timeZone: string }): {
  year: number;
  monthIndex: number;
  day: number;
  hour: number;
  minute: number;
} {
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
