import { appRouter, createCaller, type Context, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import type { ReportGenerateQueue } from "@lazuli/job-contracts";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

export const TEST_PREFIX = "GRE-66 Reports ";
export const HTTP_OK = 200;
export const ENDPOINT = "/api/trpc";

export const ADMIN: StaffUser = {
  id: "00000000-0000-0000-0000-0000000000ad",
  email: "admin@example.com",
  role: "ADMIN",
  isEnabled: true,
};

export const TEACHER: StaffUser = {
  id: "00000000-0000-0000-0000-000000002901",
  email: "gre66-reports-teacher@example.com",
  role: "TEACHER",
  isEnabled: true,
};

export type ReportsCaller = ReturnType<typeof createCaller>;

export function caller(input?: {
  staffUser?: StaffUser;
  queue?: ReportGenerateQueue;
}): ReportsCaller {
  return createCaller(contextFor(input?.staffUser ?? ADMIN, input?.queue));
}

export function contextFor(staffUser: StaffUser, queue?: ReportGenerateQueue): Context {
  return queue === undefined ? { db, staffUser } : { db, reportGenerateQueue: queue, staffUser };
}

export function recordingReportGenerateQueue(jobIdPrefix: string): {
  queue: ReportGenerateQueue;
  calls: { artifactId: string }[];
} {
  const calls: { artifactId: string }[] = [];
  const queue: ReportGenerateQueue = {
    enqueueReportGenerate: (payload) => {
      calls.push(payload);
      return Promise.resolve({
        workflowName: "report-generate",
        jobId: `${jobIdPrefix}:${payload.artifactId}`,
        payload,
      });
    },
  };

  return { queue, calls };
}

export async function ensureAdminUser(): Promise<void> {
  await db.user.upsert({
    where: { id: ADMIN.id },
    create: {
      id: ADMIN.id,
      email: ADMIN.email,
      name: "GRE-66 Reports Admin",
      role: "ADMIN",
      isEnabled: true,
    },
    update: {},
  });
}

export async function ensureTeacherUser(): Promise<void> {
  await db.user.upsert({
    where: { id: TEACHER.id },
    create: {
      id: TEACHER.id,
      email: TEACHER.email,
      name: "GRE-66 Reports Teacher",
      role: "TEACHER",
      isEnabled: true,
    },
    update: {},
  });
}

export async function seedStudent(): Promise<{ studentId: string }> {
  const student = await db.student.create({
    data: {
      fullName: `${TEST_PREFIX}Student`,
      status: "ACTIVE",
    },
  });

  return { studentId: student.id };
}

export async function seedOwnedClass(): Promise<{ classId: string }> {
  await ensureTeacherUser();
  const semester = await db.semester.create({
    data: {
      name: `${TEST_PREFIX}Semester`,
      startDate: new Date("2026-02-01"),
      endDate: new Date("2026-06-30"),
    },
  });
  const productLine = await db.productLine.create({
    data: {
      key: "gre66_reports_line",
      name: `${TEST_PREFIX}Product Line`,
      status: "ACTIVE",
    },
  });
  const track = await db.track.create({
    data: {
      productLineId: productLine.id,
      name: `${TEST_PREFIX}Track`,
      status: "ACTIVE",
    },
  });
  const stage = await db.stage.create({
    data: {
      trackId: track.id,
      name: `${TEST_PREFIX}Stage`,
      internalCode: "GRE66S1",
      sequence: 1,
    },
  });
  const classRow = await db.class.create({
    data: {
      internalCode: `${TEST_PREFIX}Class`,
      teacherId: TEACHER.id,
      scheduleType: "REGULAR",
      format: "IN_PERSON",
      sharedStageId: stage.id,
      semesterId: semester.id,
      year: 2026,
      capacity: 10,
      portalClassName: `${TEST_PREFIX}Portal`,
    },
  });

  return { classId: classRow.id };
}

export async function cleanReportsDatabase(): Promise<void> {
  await db.generatedArtifact.deleteMany({
    where: {
      OR: [
        { requestedById: ADMIN.id },
        { requestedById: TEACHER.id },
        { student: { fullName: { startsWith: TEST_PREFIX } } },
        { class: { internalCode: { startsWith: TEST_PREFIX } } },
      ],
    },
  });
  await db.class.deleteMany({ where: { internalCode: { startsWith: TEST_PREFIX } } });
  await db.stage.deleteMany({ where: { internalCode: { startsWith: "GRE66" } } });
  await db.track.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await db.productLine.deleteMany({ where: { key: { startsWith: "gre66_reports_" } } });
  await db.semester.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await db.student.deleteMany({ where: { fullName: { startsWith: TEST_PREFIX } } });
  await db.user.deleteMany({ where: { id: TEACHER.id } });
}

export async function callHttpMutation(input: {
  path: string;
  body: unknown;
  queue?: ReportGenerateQueue;
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
    createContext: () => Promise.resolve(contextFor(input.staffUser ?? ADMIN, input.queue)),
  });
}

export async function callHttpQuery(input: {
  path: string;
  body: unknown;
  staffUser?: StaffUser;
}): Promise<Response> {
  const url = new URL(`http://localhost${ENDPOINT}/${input.path}`);
  url.searchParams.set("input", JSON.stringify({ json: input.body }));

  return fetchRequestHandler({
    endpoint: ENDPOINT,
    req: new Request(url, { method: "GET" }),
    router: appRouter,
    createContext: () => Promise.resolve(contextFor(input.staffUser ?? ADMIN)),
  });
}
