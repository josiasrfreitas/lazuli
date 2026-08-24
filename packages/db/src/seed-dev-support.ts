import { createHash } from "node:crypto";

import type { PrismaClient } from "./generated/prisma/client.js";

/**
 * Shared helpers for the idempotent dev seed. Every row is keyed by a UUID
 * derived from a stable seed key, so re-running only upserts.
 */

const DATE_ONLY_LENGTH = 10;
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
  database: PrismaClient;
  todayIso: string;
  semester: SeededSemester;
  teacherIds: Map<string, string>;
  classes: Map<string, SeededClass>;
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
  return new Date(`${dateIso}T23:00:00.000Z`);
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
