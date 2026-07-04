import assert from "node:assert/strict";
import { after, before, beforeEach } from "node:test";

import { db } from "@lazuli/db";

import { cleanEnrollmentFixtures } from "./enrollment-test-support.js";

const DEFAULT_CLASS_CAPACITY = 8;
const FIXTURE_CLASS_YEAR = 2026;

export type TwoStageCatalog = {
  firstStageId: string;
  secondStageId: string;
  semesterId: string;
};

export type EnrollmentSuiteConfig = {
  prefix: string;
  catalogKey: string;
  catalogKeyPrefix: string;
  teacherId: string;
  teacherEmail: string;
  teacherName: string;
  semesterName: string;
  semesterStart: string;
  semesterEnd: string;
};

type RegularClassInput = {
  code: string;
  sharedStageId: string;
  semesterId: string;
  capacity?: number;
};

type PersonalizedClassInput = {
  code: string;
  capacity?: number;
  status?: "ACTIVE" | "ARCHIVED";
};

type ClassBaseData = {
  capacity: number;
  format: "IN_PERSON";
  internalCode: string;
  portalClassName: string;
  teacherId: string;
  year: number;
};

export type EnrollmentSuiteFixtures = {
  ensureTeacherUser: () => Promise<void>;
  seedTwoStageCatalog: () => Promise<TwoStageCatalog>;
  createStudent: (suffix: string) => Promise<{ id: string }>;
  createRegularClass: (input: RegularClassInput) => Promise<{ id: string }>;
  createPersonalizedClass: (input: PersonalizedClassInput) => Promise<{ id: string }>;
  cleanDatabase: () => Promise<void>;
  registerDbLifecycle: () => void;
};

/**
 * Builds a prefix-scoped set of enrollment DB fixtures shared by the enrollment suites
 * (GRE-30/31/32...). `test:db` runs files in parallel processes against one database, so each suite
 * passes a distinct prefix, catalog key, teacher, and far-future semester to avoid racing on the
 * global semester exclusion and catalog uniques. Centralizing the builders keeps the suites from
 * copy-pasting them (and tripping the duplication gate).
 */
export function createEnrollmentSuite(config: EnrollmentSuiteConfig): EnrollmentSuiteFixtures {
  return {
    ensureTeacherUser: () => ensureTeacherUser(config),
    seedTwoStageCatalog: () => seedTwoStageCatalog(config),
    createStudent: (suffix) => createStudent(config, suffix),
    createRegularClass: (input) => createRegularClass(config, input),
    createPersonalizedClass: (input) => createPersonalizedClass(config, input),
    cleanDatabase: () => cleanDatabase(config),
    registerDbLifecycle: () => registerDbLifecycle(config),
  };
}

async function ensureTeacherUser(config: EnrollmentSuiteConfig): Promise<void> {
  await db.user.upsert({
    where: { id: config.teacherId },
    create: {
      id: config.teacherId,
      email: config.teacherEmail,
      name: config.teacherName,
      role: "TEACHER",
      isEnabled: true,
    },
    update: {},
  });
}

async function seedTwoStageCatalog(config: EnrollmentSuiteConfig): Promise<TwoStageCatalog> {
  const productLine = await db.productLine.create({
    data: { key: config.catalogKey, name: `${config.prefix}Product Line`, status: "ACTIVE" },
  });
  const track = await db.track.create({
    data: { productLineId: productLine.id, name: `${config.prefix}Track`, status: "ACTIVE" },
  });
  const [first, second] = await Promise.all([
    db.stage.create({
      data: {
        trackId: track.id,
        name: `${config.prefix}Stage 1`,
        internalCode: `${config.catalogKey}_s1`,
        sequence: 1,
      },
    }),
    db.stage.create({
      data: {
        trackId: track.id,
        name: `${config.prefix}Stage 2`,
        internalCode: `${config.catalogKey}_s2`,
        sequence: 2,
      },
    }),
  ]);
  const semester = await db.semester.create({
    data: {
      name: config.semesterName,
      startDate: new Date(config.semesterStart),
      endDate: new Date(config.semesterEnd),
    },
  });
  return { firstStageId: first.id, secondStageId: second.id, semesterId: semester.id };
}

function createStudent(config: EnrollmentSuiteConfig, suffix: string): Promise<{ id: string }> {
  return db.student.create({
    data: { fullName: `${config.prefix}${suffix}`, status: "ACTIVE" },
    select: { id: true },
  });
}

function classBaseData(
  config: EnrollmentSuiteConfig,
  input: { code: string; capacity?: number },
): ClassBaseData {
  return {
    capacity: input.capacity ?? DEFAULT_CLASS_CAPACITY,
    format: "IN_PERSON",
    internalCode: `${config.prefix}${input.code}`,
    portalClassName: `${config.prefix}portal-${input.code}`,
    teacherId: config.teacherId,
    year: FIXTURE_CLASS_YEAR,
  };
}

function createRegularClass(
  config: EnrollmentSuiteConfig,
  input: RegularClassInput,
): Promise<{ id: string }> {
  return db.class.create({
    data: {
      ...classBaseData(config, input),
      scheduleType: "REGULAR",
      semesterId: input.semesterId,
      sharedStageId: input.sharedStageId,
    },
    select: { id: true },
  });
}

function createPersonalizedClass(
  config: EnrollmentSuiteConfig,
  input: PersonalizedClassInput,
): Promise<{ id: string }> {
  return db.class.create({
    data: {
      ...classBaseData(config, input),
      scheduleType: "PERSONALIZED",
      status: input.status ?? "ACTIVE",
    },
    select: { id: true },
  });
}

async function cleanDatabase(config: EnrollmentSuiteConfig): Promise<void> {
  await cleanEnrollmentFixtures({
    prefix: config.prefix,
    catalogKeyPrefix: config.catalogKeyPrefix,
    teacherId: config.teacherId,
  });
}

function registerDbLifecycle(config: EnrollmentSuiteConfig): void {
  before(async () => {
    await db.$connect();
  });
  beforeEach(async () => {
    await cleanDatabase(config);
  });
  after(async () => {
    await cleanDatabase(config);
    await db.$disconnect();
  });
}

/** Asserts the enrollment holds exactly one active progress at `stageId` and is still active. */
export async function assertActiveStageAndOpenEnrollment(input: {
  enrollmentId: string;
  stageId: string;
}): Promise<void> {
  const active = await db.pedagogicalProgress.findMany({
    where: { enrollmentId: input.enrollmentId, endDate: null },
    select: { stageId: true },
  });
  assert.equal(active.length, 1);
  assert.equal(active[0]?.stageId, input.stageId);

  const enrollment = await db.enrollment.findUniqueOrThrow({
    where: { id: input.enrollmentId },
    select: { exitDate: true },
  });
  assert.equal(enrollment.exitDate, null);
}
