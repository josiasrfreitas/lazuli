import assert from "node:assert/strict";

import { appRouter, createCaller, type Context, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

export const TEST_PREFIX = "GRE-30 Enroll ";
export const CATALOG_KEY = "gre30_enroll_line";
export const CATALOG_KEY_PREFIX = "gre30_enroll_";
export const HTTP_OK = 200;
export const ENDPOINT = "/api/trpc";

const DEFAULT_CLASS_CAPACITY = 8;
const FIXTURE_CLASS_YEAR = 2026;

export const ADMIN: StaffUser = {
  id: "00000000-0000-0000-0000-0000000000ad",
  email: "admin@example.com",
  role: "ADMIN",
  isEnabled: true,
};

export const TEACHER_USER_ID = "00000000-0000-0000-0000-000000003001";

export type EnrollmentCaller = ReturnType<typeof createCaller>;

export function caller(): EnrollmentCaller {
  return createCaller(contextFor(ADMIN));
}

export function contextFor(staffUser: StaffUser): Context {
  return { db, staffUser };
}

export type CatalogFixture = {
  activeStageId: string;
  semesterId: string;
};

export async function ensureTeacherUser(): Promise<void> {
  await db.user.upsert({
    where: { id: TEACHER_USER_ID },
    create: {
      id: TEACHER_USER_ID,
      email: "gre30-enroll-teacher@example.com",
      name: "GRE-30 Enroll Teacher",
      role: "TEACHER",
      isEnabled: true,
    },
    update: {},
  });
}

export async function seedCatalog(): Promise<CatalogFixture> {
  const productLine = await db.productLine.create({
    data: { key: CATALOG_KEY, name: `${TEST_PREFIX}Product Line`, status: "ACTIVE" },
  });
  const track = await db.track.create({
    data: { productLineId: productLine.id, name: `${TEST_PREFIX}Track`, status: "ACTIVE" },
  });
  const stage = await db.stage.create({
    data: { trackId: track.id, name: `${TEST_PREFIX}Stage`, internalCode: "GRE30S1", sequence: 1 },
  });
  // Far-future, unique range: the Semester non-overlap exclusion is global, and node runs
  // test files in parallel, so this must not collide with other suites' semesters.
  const semester = await db.semester.create({
    data: {
      name: `${TEST_PREFIX}2071.1`,
      startDate: new Date("2071-02-01"),
      endDate: new Date("2071-06-30"),
    },
  });

  return { activeStageId: stage.id, semesterId: semester.id };
}

export async function createStudent(input: {
  suffix: string;
  status?: "ACTIVE" | "INACTIVE" | "DROPPED" | "SUSPENDED";
}): Promise<{ id: string }> {
  return db.student.create({
    data: { fullName: `${TEST_PREFIX}${input.suffix}`, status: input.status ?? "ACTIVE" },
    select: { id: true },
  });
}

export async function createRegularClass(input: {
  code: string;
  sharedStageId: string;
  semesterId: string;
  capacity?: number;
}): Promise<{ id: string }> {
  return db.class.create({
    data: {
      capacity: input.capacity ?? DEFAULT_CLASS_CAPACITY,
      format: "IN_PERSON",
      internalCode: `${TEST_PREFIX}${input.code}`,
      portalClassName: `${TEST_PREFIX}portal-${input.code}`,
      scheduleType: "REGULAR",
      semesterId: input.semesterId,
      sharedStageId: input.sharedStageId,
      teacherId: TEACHER_USER_ID,
      year: FIXTURE_CLASS_YEAR,
    },
    select: { id: true },
  });
}

export async function createPersonalizedClass(input: {
  code: string;
  capacity?: number;
  status?: "ACTIVE" | "ARCHIVED";
}): Promise<{ id: string }> {
  return db.class.create({
    data: {
      capacity: input.capacity ?? DEFAULT_CLASS_CAPACITY,
      format: "IN_PERSON",
      internalCode: `${TEST_PREFIX}${input.code}`,
      portalClassName: `${TEST_PREFIX}portal-${input.code}`,
      scheduleType: "PERSONALIZED",
      status: input.status ?? "ACTIVE",
      teacherId: TEACHER_USER_ID,
      year: FIXTURE_CLASS_YEAR,
    },
    select: { id: true },
  });
}

export async function callHttpMutation(input: {
  path: string;
  body: unknown;
  staffUser?: StaffUser;
}): Promise<Response> {
  return fetchRequestHandler({
    endpoint: ENDPOINT,
    req: new Request(`http://localhost${ENDPOINT}/${input.path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: input.body }),
    }),
    router: appRouter,
    createContext: () => Promise.resolve(contextFor(input.staffUser ?? ADMIN)),
  });
}

/** Namespacing so parallel enrollment suites (GRE-30, GRE-31, ...) never race on shared rows. */
export type EnrollmentFixtureConfig = {
  prefix: string;
  catalogKeyPrefix: string;
  teacherId: string;
};

/** Asserts a promise rejects with an Error whose message contains `message` (PT-BR domain error). */
export async function expectRejects(promise: Promise<unknown>, message: string): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof Error, "expected an Error");
    assert.ok(
      error.message.includes(message),
      `expected message to include "${message}", got "${error.message}"`,
    );
    return true;
  });
}

/** Prefix/key/teacher-scoped cleanup, FK-safe order. Shared by every enrollment fixture namespace. */
export async function cleanEnrollmentFixtures(config: EnrollmentFixtureConfig): Promise<void> {
  await db.pedagogicalProgress.deleteMany({
    where: { enrollment: { student: { fullName: { startsWith: config.prefix } } } },
  });
  await db.enrollment.deleteMany({
    where: { student: { fullName: { startsWith: config.prefix } } },
  });
  await db.student.deleteMany({ where: { fullName: { startsWith: config.prefix } } });
  await db.class.deleteMany({ where: { internalCode: { startsWith: config.prefix } } });
  await db.semester.deleteMany({ where: { name: { startsWith: config.prefix } } });
  await db.stage.deleteMany({
    where: { track: { productLine: { key: { startsWith: config.catalogKeyPrefix } } } },
  });
  await db.track.deleteMany({
    where: { productLine: { key: { startsWith: config.catalogKeyPrefix } } },
  });
  await db.productLine.deleteMany({ where: { key: { startsWith: config.catalogKeyPrefix } } });
  await db.user.deleteMany({ where: { id: config.teacherId } });
}

export async function cleanEnrollmentDatabase(): Promise<void> {
  await cleanEnrollmentFixtures({
    prefix: TEST_PREFIX,
    catalogKeyPrefix: CATALOG_KEY_PREFIX,
    teacherId: TEACHER_USER_ID,
  });
}
