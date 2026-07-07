import assert from "node:assert/strict";

import { appRouter, createCaller, type Context, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

export const HTTP_OK = 200;
export const HTTP_FORBIDDEN = 403;
const ENDPOINT = "/api/trpc";
const DEFAULT_CLASS_CAPACITY = 20;
const FIXTURE_CLASS_YEAR = 2011;
const SESSION_START_TIME = new Date("1970-01-01T14:00:00.000Z");
const SESSION_END_TIME = new Date("1970-01-01T16:00:00.000Z");

// node runs test files in parallel, so each db test file owns a distinct namespace (prefix, catalog key,
// user ids, and a non-overlapping past Semester window) to avoid racing on the global unique/exclusion
// constraints. The past session date keeps the untaken-session derivations exercisable.
export type Namespace = {
  prefix: string;
  catalogKey: string;
  catalogKeyPrefix: string;
  stageCode: string;
  semesterName: string;
  semesterStart: Date;
  semesterEnd: Date;
  sessionDate: Date;
  afterSessionDate: Date;
  admin: StaffUser;
  teacher: StaffUser;
  otherTeacher: StaffUser;
};

export type BaseScenario = {
  classId: string;
  sessionId: string;
  semesterId: string;
  stageId: string;
};

export type EnrollInput = {
  classId: string;
  stageId: string;
  suffix: string;
  entryDate?: Date;
  exitDate?: Date;
};

export type CreateClassInput = {
  code: string;
  teacherId: string;
  stageId: string;
  semesterId: string;
};

export type CreateSessionInput = {
  classId: string;
  date?: Date;
  status?: "SCHEDULED" | "CANCELLED";
};

export type AttendanceCaller = ReturnType<typeof createCaller>;

export type Harness = {
  ns: Namespace;
  caller: (staffUser?: StaffUser) => AttendanceCaller;
  seedBaseScenario: () => Promise<BaseScenario>;
  enrollStudent: (input: EnrollInput) => Promise<{ studentId: string; enrollmentId: string }>;
  createClass: (input: CreateClassInput) => Promise<string>;
  createSession: (input: CreateSessionInput) => Promise<string>;
  clean: () => Promise<void>;
};

export function contextFor(staffUser: StaffUser): Context {
  return { db, staffUser };
}

export function createHarness(ns: Namespace): Harness {
  return {
    ns,
    caller: (staffUser) => createCaller(contextFor(staffUser ?? ns.admin)),
    seedBaseScenario: () => seedBaseScenario(ns),
    enrollStudent: (input) => enrollStudent(ns, input),
    createClass: (input) => createClass(ns, input),
    createSession: (input) => createSession(ns, input),
    clean: () => cleanNamespace(ns),
  };
}

export type NamespaceConfig = {
  label: string;
  startDate: string;
  endDate: string;
  sessionDate: string;
  afterSessionDate: string;
  adminId: string;
  teacherId: string;
  otherTeacherId: string;
};

function toUtcDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

/** Builds an isolated namespace from the varying bits, centralizing the repeated derivations. */
export function defineNamespace(config: NamespaceConfig): Namespace {
  const prefix = `GRE-61 ${config.label} `;
  const email = (who: string): string => `gre61-${config.label}-${who}@example.com`;

  return {
    prefix,
    catalogKey: `gre61_${config.label}_line`,
    catalogKeyPrefix: `gre61_${config.label}_`,
    stageCode: `GRE61${config.label.toUpperCase()}`,
    semesterName: `${prefix}sem`,
    semesterStart: toUtcDate(config.startDate),
    semesterEnd: toUtcDate(config.endDate),
    sessionDate: toUtcDate(config.sessionDate),
    afterSessionDate: toUtcDate(config.afterSessionDate),
    admin: { id: config.adminId, email: email("admin"), role: "ADMIN", isEnabled: true },
    teacher: { id: config.teacherId, email: email("teacher"), role: "TEACHER", isEnabled: true },
    otherTeacher: {
      id: config.otherTeacherId,
      email: email("other"),
      role: "TEACHER",
      isEnabled: true,
    },
  };
}

async function seedBaseScenario(ns: Namespace): Promise<BaseScenario> {
  await seedUsers(ns);
  const stageId = await seedCatalog(ns);
  const semesterId = await seedSemester(ns);
  const classId = await createClass(ns, {
    code: "main",
    teacherId: ns.teacher.id,
    stageId,
    semesterId,
  });
  const sessionId = await createSession(ns, { classId });

  return { classId, sessionId, semesterId, stageId };
}

async function seedUsers(ns: Namespace): Promise<void> {
  for (const staffUser of [ns.admin, ns.teacher, ns.otherTeacher]) {
    await db.user.upsert({
      where: { id: staffUser.id },
      create: {
        id: staffUser.id,
        email: staffUser.email,
        name: `${ns.prefix}${staffUser.role}`,
        role: staffUser.role,
        isEnabled: true,
      },
      update: {},
    });
  }
}

async function seedCatalog(ns: Namespace): Promise<string> {
  const productLine = await db.productLine.create({
    data: { key: ns.catalogKey, name: `${ns.prefix}Line`, status: "ACTIVE" },
    select: { id: true },
  });
  const track = await db.track.create({
    data: { name: `${ns.prefix}Track`, productLineId: productLine.id, status: "ACTIVE" },
    select: { id: true },
  });
  const stage = await db.stage.create({
    data: { internalCode: ns.stageCode, name: `${ns.prefix}Stage`, sequence: 1, trackId: track.id },
    select: { id: true },
  });

  return stage.id;
}

async function seedSemester(ns: Namespace): Promise<string> {
  const semester = await db.semester.create({
    data: { name: ns.semesterName, startDate: ns.semesterStart, endDate: ns.semesterEnd },
    select: { id: true },
  });

  return semester.id;
}

async function createClass(ns: Namespace, input: CreateClassInput): Promise<string> {
  const classRow = await db.class.create({
    data: {
      capacity: DEFAULT_CLASS_CAPACITY,
      format: "IN_PERSON",
      internalCode: `${ns.prefix}${input.code}`,
      portalClassName: `${ns.prefix}portal-${input.code}`,
      scheduleType: "REGULAR",
      semesterId: input.semesterId,
      sharedStageId: input.stageId,
      teacherId: input.teacherId,
      year: FIXTURE_CLASS_YEAR,
    },
    select: { id: true },
  });

  return classRow.id;
}

async function createSession(ns: Namespace, input: CreateSessionInput): Promise<string> {
  const cancelled = input.status === "CANCELLED";
  const session = await db.classSession.create({
    data: {
      classId: input.classId,
      date: input.date ?? ns.sessionDate,
      startTime: SESSION_START_TIME,
      endTime: SESSION_END_TIME,
      status: input.status ?? "SCHEDULED",
      ...(cancelled ? { cancelReason: `${ns.prefix}closure`, cancelledAt: new Date() } : {}),
    },
    select: { id: true },
  });

  return session.id;
}

/**
 * Enrolls a fresh student into a class with an active progress record; returns both ids. Enrollment and
 * progress are created in one transaction so the deferrable "one active progress per active enrollment"
 * check sees them together.
 */
async function enrollStudent(
  ns: Namespace,
  input: EnrollInput,
): Promise<{ studentId: string; enrollmentId: string }> {
  const startDate = input.entryDate ?? ns.sessionDate;
  const closed =
    input.exitDate === undefined ? {} : { endDate: input.exitDate, endReason: "DROPPED" as const };
  const student = await db.student.create({
    data: { fullName: `${ns.prefix}${input.suffix}`, status: "ACTIVE" },
    select: { id: true },
  });
  const enrollmentId = await db.$transaction(async (transaction) => {
    const enrollment = await transaction.enrollment.create({
      data: {
        classId: input.classId,
        studentId: student.id,
        entryDate: startDate,
        ...(input.exitDate === undefined
          ? {}
          : { exitDate: input.exitDate, exitReason: "DROPPED" }),
      },
      select: { id: true },
    });
    await transaction.pedagogicalProgress.create({
      data: { enrollmentId: enrollment.id, stageId: input.stageId, startDate, ...closed },
    });

    return enrollment.id;
  });

  return { studentId: student.id, enrollmentId };
}

export async function callHttpMutation(input: {
  path: string;
  body: unknown;
  staffUser: StaffUser;
}): Promise<Response> {
  return fetchRequestHandler({
    endpoint: ENDPOINT,
    req: new Request(`http://localhost${ENDPOINT}/${input.path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: input.body }),
    }),
    router: appRouter,
    createContext: () => Promise.resolve(contextFor(input.staffUser)),
  });
}

export async function callHttpQuery(input: {
  path: string;
  input: unknown;
  staffUser: StaffUser;
}): Promise<Response> {
  const query = encodeURIComponent(JSON.stringify({ json: input.input }));
  return fetchRequestHandler({
    endpoint: ENDPOINT,
    req: new Request(`http://localhost${ENDPOINT}/${input.path}?input=${query}`, { method: "GET" }),
    router: appRouter,
    createContext: () => Promise.resolve(contextFor(input.staffUser)),
  });
}

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

/** Prefix/key/user-scoped cleanup in FK-safe order. */
async function cleanNamespace(ns: Namespace): Promise<void> {
  const byStudent = { enrollment: { student: { fullName: { startsWith: ns.prefix } } } };
  await db.attendance.deleteMany({ where: byStudent });
  await db.makeup.deleteMany({
    where: { originEnrollment: { student: { fullName: { startsWith: ns.prefix } } } },
  });
  await db.pedagogicalProgress.deleteMany({ where: byStudent });
  await db.enrollment.deleteMany({ where: { student: { fullName: { startsWith: ns.prefix } } } });
  await db.classSession.deleteMany({
    where: { class: { internalCode: { startsWith: ns.prefix } } },
  });
  await db.student.deleteMany({ where: { fullName: { startsWith: ns.prefix } } });
  await db.class.deleteMany({ where: { internalCode: { startsWith: ns.prefix } } });
  await db.semester.deleteMany({ where: { name: { startsWith: ns.prefix } } });
  await db.stage.deleteMany({
    where: { track: { productLine: { key: { startsWith: ns.catalogKeyPrefix } } } },
  });
  await db.track.deleteMany({
    where: { productLine: { key: { startsWith: ns.catalogKeyPrefix } } },
  });
  await db.productLine.deleteMany({ where: { key: { startsWith: ns.catalogKeyPrefix } } });
  await db.user.deleteMany({
    where: { id: { in: [ns.admin.id, ns.teacher.id, ns.otherTeacher.id] } },
  });
}
