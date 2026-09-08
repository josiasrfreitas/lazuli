import assert from "node:assert/strict";

import { appRouter, createCaller, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import {
  assertActiveStageAndOpenEnrollment,
  cleanEnrollmentFixtures,
  createEnrollmentSuite,
  createPersonalizedClassFor,
  createRegularClassFor,
  createStudentFor,
  ensureTeacherFor,
  seedCatalogFor,
  type EnrollmentSuiteConfig,
  type PersonalizedClassInput,
  type RegularClassInput,
  type StudentFixtureInput,
} from "./enrollment/fixtures.js";

export type { CatalogFixture, TwoStageCatalog } from "./enrollment/fixtures.js";

const ADMIN: StaffUser = {
  id: "00000000-0000-0000-0000-0000000000ad",
  name: "Admin de Teste",
  email: "admin@example.com",
  role: "ADMIN",
  isEnabled: true,
};

const HTTP_OK = 200;
const ENDPOINT = "/api/trpc";

type EnrollmentCaller = ReturnType<typeof createCaller>;

function caller(): EnrollmentCaller {
  return createCaller({ db, staffUser: ADMIN });
}

async function callHttpMutation(input: {
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
    createContext: () => Promise.resolve({ db, staffUser: input.staffUser ?? ADMIN }),
  });
}

async function rejectionMessage(promise: Promise<unknown>): Promise<string> {
  return promise.then(
    () => {
      throw new Error("expected the operation to reject");
    },
    (error: unknown) => {
      assert.ok(error instanceof Error, "expected an Error");
      return error.message;
    },
  );
}

const common = { ADMIN, HTTP_OK, caller, callHttpMutation, rejectionMessage };

const CREATE_CONFIG: EnrollmentSuiteConfig = {
  prefix: "GRE-30 Enroll ",
  catalogKey: "gre30_enroll_line",
  catalogKeyPrefix: "gre30_enroll_",
  teacherId: "00000000-0000-0000-0000-000000003001",
  teacherEmail: "gre30-enroll-teacher@example.com",
  teacherName: "GRE-30 Enroll Teacher",
  semesterName: "GRE-30 Enroll 2071.1",
  semesterStart: "2071-02-01",
  semesterEnd: "2071-06-30",
  firstStageInternalCode: "GRE30S1",
};

export const gre30Enrollment = {
  ...common,
  ensureTeacherUser: () => ensureTeacherFor(CREATE_CONFIG),
  seedCatalog: () => seedCatalogFor(CREATE_CONFIG),
  createStudent: (input: StudentFixtureInput) => createStudentFor(CREATE_CONFIG, input),
  createRegularClass: (input: RegularClassInput) => createRegularClassFor(CREATE_CONFIG, input),
  createPersonalizedClass: (input: PersonalizedClassInput) =>
    createPersonalizedClassFor(CREATE_CONFIG, input),
  cleanDatabase: () => cleanEnrollmentFixtures(CREATE_CONFIG),
};

const ADVANCE_CONFIG: EnrollmentSuiteConfig = {
  prefix: "GRE-31 Advance ",
  catalogKey: "gre31_advance_line",
  catalogKeyPrefix: "gre31_advance_",
  teacherId: "00000000-0000-0000-0000-000000003101",
  teacherEmail: "gre31-advance-teacher@example.com",
  teacherName: "GRE-31 Advance Teacher",
  semesterName: "GRE-31 Advance 2072.1",
  semesterStart: "2072-02-01",
  semesterEnd: "2072-06-30",
  firstStageInternalCode: "GRE31S1",
  secondStageInternalCode: "GRE31S2",
};

const advanceSuite = createEnrollmentSuite(ADVANCE_CONFIG);

export const gre31AdvanceEnrollment = {
  ...common,
  ...advanceSuite,
  createPersonalizedClass: (code: string, semesterId: string) =>
    createPersonalizedClassFor(ADVANCE_CONFIG, { code, semesterId }),
  enrollAtStage: enrollStudent,
  closeEnrollment: async (enrollmentId: string): Promise<void> => {
    const enrollment = await db.enrollment.findUniqueOrThrow({
      where: { id: enrollmentId },
      select: { entryDate: true },
    });
    await db.$transaction(async (transaction) => {
      await transaction.pedagogicalProgress.updateMany({
        where: { enrollmentId, endDate: null },
        data: { endDate: enrollment.entryDate, endReason: "DROPPED" },
      });
      await transaction.enrollment.update({
        where: { id: enrollmentId },
        data: { exitDate: enrollment.entryDate, exitReason: "DROPPED" },
      });
    });
  },
  assertActiveStageAndOpenEnrollment,
  registerAdvanceDbLifecycle: advanceSuite.registerDbLifecycle,
};

const LIFECYCLE_CONFIG: EnrollmentSuiteConfig = {
  prefix: "GRE-32 Lifecycle ",
  catalogKey: "gre32_lifecycle_line",
  catalogKeyPrefix: "gre32_lifecycle_",
  teacherId: "00000000-0000-0000-0000-000000003201",
  teacherEmail: "gre32-lifecycle-teacher@example.com",
  teacherName: "GRE-32 Lifecycle Teacher",
  semesterName: "GRE-32 Lifecycle 2073.1",
  semesterStart: "2073-02-01",
  semesterEnd: "2073-06-30",
};

const HTTP_CONFIG: EnrollmentSuiteConfig = {
  prefix: "GRE-32 Lifecycle HTTP ",
  catalogKey: "gre32_lifecycle_http_line",
  catalogKeyPrefix: "gre32_lifecycle_http_",
  teacherId: "00000000-0000-0000-0000-000000003202",
  teacherEmail: "gre32-lifecycle-http-teacher@example.com",
  teacherName: "GRE-32 Lifecycle HTTP Teacher",
  semesterName: "GRE-32 Lifecycle HTTP 2074.1",
  semesterStart: "2074-02-01",
  semesterEnd: "2074-06-30",
};

type LifecycleEnrollment = ReturnType<typeof createEnrollmentSuite> &
  typeof common & {
    enrollRegular: (input: { studentId: string; classId: string }) => Promise<string>;
    enrollPersonalized: (input: {
      studentId: string;
      classId: string;
      stageId: string;
    }) => Promise<string>;
    assertEnrollmentClosed: typeof assertEnrollmentClosed;
    assertActiveStageAndOpenEnrollment: typeof assertActiveStageAndOpenEnrollment;
    registerLifecycleDbLifecycle: () => void;
  };

export const gre32LifecycleEnrollment = createLifecycleEnrollment(LIFECYCLE_CONFIG);
export const gre32LifecycleHttpEnrollment = createLifecycleEnrollment(HTTP_CONFIG);

function createLifecycleEnrollment(config: EnrollmentSuiteConfig): LifecycleEnrollment {
  const suite = createEnrollmentSuite(config);

  return {
    ...common,
    ...suite,
    enrollRegular: enrollStudent,
    enrollPersonalized: enrollStudent,
    assertEnrollmentClosed,
    assertActiveStageAndOpenEnrollment,
    registerLifecycleDbLifecycle: suite.registerDbLifecycle,
  };
}

async function assertEnrollmentClosed(input: {
  enrollmentId: string;
  exitReason: "TRANSFERRED" | "DROPPED" | "SUSPENDED";
}): Promise<void> {
  const enrollment = await db.enrollment.findUniqueOrThrow({
    where: { id: input.enrollmentId },
    select: { exitDate: true, exitReason: true },
  });
  assert.notEqual(enrollment.exitDate, null);
  assert.equal(enrollment.exitReason, input.exitReason);

  const activeProgress = await db.pedagogicalProgress.count({
    where: { enrollmentId: input.enrollmentId, endDate: null },
  });
  assert.equal(activeProgress, 0);

  const closedProgress = await db.pedagogicalProgress.findMany({
    where: { enrollmentId: input.enrollmentId, endDate: { not: null } },
    select: { endReason: true },
  });
  assert.equal(closedProgress.length, 1);
  assert.equal(closedProgress[0]?.endReason, input.exitReason);
}

async function enrollStudent(input: {
  studentId: string;
  classId: string;
  stageId?: string;
}): Promise<string> {
  const result = await caller().enrollment.create(input);
  return result.enrollment.id;
}
