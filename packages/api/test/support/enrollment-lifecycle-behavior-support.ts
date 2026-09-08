import { createEnrollmentSuite, type TwoStageCatalog } from "./enrollment-suite-support.js";

export {
  ADMIN,
  assertActiveStageAndOpenEnrollment,
  assertEnrollmentClosed,
  callHttpMutation,
  enrollPersonalized,
  enrollRegular,
  HTTP_OK,
} from "./enrollment-lifecycle-support.js";

// Distinct prefix from `enrollment-lifecycle-support.ts`: behavior and integration files run in
// parallel against one database, so they must not share cleanup namespaces.
export type TwoStageCatalogFixture = TwoStageCatalog;

const suite = createEnrollmentSuite({
  prefix: "GRE-32 Lifecycle HTTP ",
  catalogKey: "gre32_lifecycle_http_line",
  catalogKeyPrefix: "gre32_lifecycle_http_",
  teacherId: "00000000-0000-0000-0000-000000003202",
  teacherEmail: "gre32-lifecycle-http-teacher@example.com",
  teacherName: "GRE-32 Lifecycle HTTP Teacher",
  semesterName: "GRE-32 Lifecycle HTTP 2074.1",
  semesterStart: "2074-02-01",
  semesterEnd: "2074-06-30",
});

export const ensureTeacherUser = suite.ensureTeacherUser;
export const seedTwoStageCatalog = suite.seedTwoStageCatalog;
export const createStudent = suite.createStudent;
export const createRegularClass = suite.createRegularClass;
export const createPersonalizedClass = suite.createPersonalizedClass;
export const registerLifecycleDbLifecycle = suite.registerDbLifecycle;
