import { createHash } from "node:crypto";

import type { DevClassSeed } from "./seed-dev-data.js";

import type { DatabaseClient } from "./client.js";

/**
 * Shared date and identity helpers for the complete school seed.
 */

const DATE_ONLY_LENGTH = 10;
const SAO_PAULO_END_DAY_UTC_HOUR = 2;
const END_DAY_MINUTE = 59;
const UUID_TIME_LOW_END = 8;
const UUID_TIME_MID_END = 12;
const UUID_VERSION_END = 16;
const UUID_VARIANT_END = 20;
const UUID_NODE_END = 32;

export type SemesterSeed = { name: string; startIso: string; endIso: string; year: number };
export type SeededSemester = SemesterSeed & { id: string };
export type SeededSession = { id: string; dateIso: string; index: number };
export type SeededClass = {
  id: string;
  teacherId: string;
  stageId: string;
  sessions: SeededSession[];
};

export type SeedContext = {
  database: DatabaseClient;
  todayIso: string;
  semester: SeededSemester;
  teacherIds: Map<string, string>;
  classes: Map<string, SeededClass>;
  adminId: string;
  closedDates: Set<string>;
  resolveClassName: (classSeed: DevClassSeed, semester: SeededSemester) => Promise<string>;
};

export function stableUuid(parts: readonly string[]): string {
  const hex = createHash("sha256").update(parts.join("/")).digest("hex");
  return [
    hex.slice(0, UUID_TIME_LOW_END),
    hex.slice(UUID_TIME_LOW_END, UUID_TIME_MID_END),
    hex.slice(UUID_TIME_MID_END, UUID_VERSION_END),
    hex.slice(UUID_VERSION_END, UUID_VARIANT_END),
    hex.slice(UUID_VARIANT_END, UUID_NODE_END),
  ].join("-");
}

export function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function timeOfDay(wallTime: string): Date {
  return new Date(`1970-01-01T${wallTime}:00.000Z`);
}

export function endOfDayUtc(dateIso: string): Date {
  // 23:59 in São Paulo is 02:59 UTC on the following civil day.
  const date = addDays(utcDate(dateIso), 1);
  date.setUTCHours(SAO_PAULO_END_DAY_UTC_HOUR, END_DAY_MINUTE, 0, 0);
  return date;
}

export function isoOf(date: Date): string {
  return date.toISOString().slice(0, DATE_ONLY_LENGTH);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function saoPauloTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function requireValue<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Dev seed misconfiguration: missing ${label}.`);
  }
  return value;
}

/** Enrollment cannot start in the future merely because the fixture has a late-entry profile. */
export function enrollmentEntryIso(input: {
  semesterStartIso: string;
  todayIso: string;
  entryOffsetDays?: number | undefined;
}): string {
  const proposed = isoOf(addDays(utcDate(input.semesterStartIso), input.entryOffsetDays ?? 0));
  return proposed < input.todayIso ? proposed : input.todayIso;
}
