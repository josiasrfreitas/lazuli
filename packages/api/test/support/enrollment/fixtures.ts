import assert from "node:assert/strict";
import { after, before, beforeEach } from "node:test";

import { db } from "@lazuli/db";

export type CatalogFixture = {
  activeStageId: string;
  semesterId: string;
};

export type TwoStageCatalog = {
  firstStageId: string;
  secondStageId: string;
  semesterId: string;
};

export type EnrollmentFixtureConfig = {
  prefix: string;
  catalogKeyPrefix: string;
  teacherId: string;
};

export type EnrollmentSuiteConfig = EnrollmentFixtureConfig & {
  catalogKey: string;
  teacherEmail: string;
  teacherName: string;
  semesterName: string;
  semesterStart: string;
  semesterEnd: string;
  firstStageInternalCode?: string;
  secondStageInternalCode?: string;
};

export type StudentFixtureInput = {
  suffix: string;
  status?: "ACTIVE" | "INACTIVE" | "DROPPED" | "SUSPENDED";
};

export type RegularClassInput = {
  code: string;
  sharedStageId: string;
  semesterId: string;
  capacity?: number;
};

export type PersonalizedClassInput = {
  code: string;
  semesterId: string;
  capacity?: number;
  status?: "ACTIVE" | "ARCHIVED";
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

const DEFAULT_CLASS_CAPACITY = 8;
const FIXTURE_CLASS_YEAR = 2026;

export async function ensureTeacherFor(config: EnrollmentSuiteConfig): Promise<void> {
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

export async function createStudentFor(
  config: Pick<EnrollmentSuiteConfig, "prefix">,
  input: StudentFixtureInput,
): Promise<{ id: string }> {
  return db.student.create({
    data: { fullName: `${config.prefix}${input.suffix}`, status: input.status ?? "ACTIVE" },
    select: { id: true },
  });
}

export async function seedCatalogFor(config: EnrollmentSuiteConfig): Promise<CatalogFixture> {
  const { trackId } = await createCatalogBase(config);
  const stage = await db.stage.create({
    data: {
      trackId,
      name: `${config.prefix}Stage`,
      internalCode: config.firstStageInternalCode ?? `${config.catalogKey}_s1`,
      sequence: 1,
    },
  });
  const semester = await createSemester(config);

  return { activeStageId: stage.id, semesterId: semester.id };
}

export async function seedTwoStageCatalogFor(
  config: EnrollmentSuiteConfig,
): Promise<TwoStageCatalog> {
  const { trackId } = await createCatalogBase(config);
  const [first, second] = await Promise.all([
    db.stage.create({
      data: {
        trackId,
        name: `${config.prefix}Stage 1`,
        internalCode: config.firstStageInternalCode ?? `${config.catalogKey}_s1`,
        sequence: 1,
      },
    }),
    db.stage.create({
      data: {
        trackId,
        name: `${config.prefix}Stage 2`,
        internalCode: config.secondStageInternalCode ?? `${config.catalogKey}_s2`,
        sequence: 2,
      },
    }),
  ]);
  const semester = await createSemester(config);

  return { firstStageId: first.id, secondStageId: second.id, semesterId: semester.id };
}

export async function createRegularClassFor(
  config: Pick<EnrollmentSuiteConfig, "prefix" | "teacherId">,
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

export async function createPersonalizedClassFor(
  config: Pick<EnrollmentSuiteConfig, "prefix" | "teacherId">,
  input: PersonalizedClassInput,
): Promise<{ id: string }> {
  return db.class.create({
    data: {
      ...classBaseData(config, input),
      scheduleType: "PERSONALIZED",
      semesterId: input.semesterId,
      status: input.status ?? "ACTIVE",
    },
    select: { id: true },
  });
}

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

export function createEnrollmentSuite(config: EnrollmentSuiteConfig): EnrollmentSuiteFixtures {
  return {
    ensureTeacherUser: () => ensureTeacherFor(config),
    seedTwoStageCatalog: () => seedTwoStageCatalogFor(config),
    createStudent: (suffix) => createStudentFor(config, { suffix }),
    createRegularClass: (input) => createRegularClassFor(config, input),
    createPersonalizedClass: (input) => createPersonalizedClassFor(config, input),
    cleanDatabase: () => cleanEnrollmentFixtures(config),
    registerDbLifecycle: () => registerDbLifecycle(config),
  };
}

export function registerDbLifecycle(config: EnrollmentFixtureConfig): void {
  before(async () => db.$connect());
  beforeEach(async () => cleanEnrollmentFixtures(config));
  after(async () => {
    await cleanEnrollmentFixtures(config);
    await db.$disconnect();
  });
}

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

function classBaseData(
  config: Pick<EnrollmentSuiteConfig, "prefix" | "teacherId">,
  input: { code: string; capacity?: number },
): {
  capacity: number;
  format: "IN_PERSON";
  internalCode: string;
  portalClassName: string;
  teacherId: string;
  year: number;
} {
  return {
    capacity: input.capacity ?? DEFAULT_CLASS_CAPACITY,
    format: "IN_PERSON",
    internalCode: `${config.prefix}${input.code}`,
    portalClassName: `${config.prefix}portal-${input.code}`,
    teacherId: config.teacherId,
    year: FIXTURE_CLASS_YEAR,
  };
}

async function createCatalogBase(config: EnrollmentSuiteConfig): Promise<{ trackId: string }> {
  const productLine = await db.productLine.create({
    data: { key: config.catalogKey, name: `${config.prefix}Product Line`, status: "ACTIVE" },
  });
  const track = await db.track.create({
    data: { productLineId: productLine.id, name: `${config.prefix}Track`, status: "ACTIVE" },
  });
  return { trackId: track.id };
}

function createSemester(config: EnrollmentSuiteConfig): Promise<{ id: string }> {
  return db.semester.create({
    data: {
      name: config.semesterName,
      startDate: new Date(config.semesterStart),
      endDate: new Date(config.semesterEnd),
    },
    select: { id: true },
  });
}
