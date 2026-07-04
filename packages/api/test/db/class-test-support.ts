import { appRouter, createCaller, type Context, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import type { SessionsGenerateQueue } from "@lazuli/job-contracts";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

export const TEST_PREFIX = "GRE-29 Class ";
export const HTTP_OK = 200;
export const ENDPOINT = "/api/trpc";

export const ADMIN: StaffUser = {
  id: "00000000-0000-0000-0000-0000000000ad",
  email: "admin@example.com",
  role: "ADMIN",
  isEnabled: true,
};

export const TEACHER_USER_ID = "00000000-0000-0000-0000-000000002901";

export type ClassCaller = ReturnType<typeof createCaller>;

export function caller(): ClassCaller {
  return createCaller(contextFor(ADMIN));
}

export function contextFor(staffUser: StaffUser): Context {
  return { db, staffUser };
}

export function contextWithQueue(input: {
  queue: SessionsGenerateQueue;
  staffUser?: StaffUser;
}): Context {
  return { db, sessionGenerationQueue: input.queue, staffUser: input.staffUser ?? ADMIN };
}

export async function ensureTeacherUser(): Promise<void> {
  await db.user.upsert({
    where: { id: TEACHER_USER_ID },
    create: {
      id: TEACHER_USER_ID,
      email: "gre29-class-teacher@example.com",
      name: "GRE-29 Class Teacher",
      role: "TEACHER",
      isEnabled: true,
    },
    update: {},
  });
}

export async function seedClassCatalogFixtures(): Promise<{
  stageId: string;
  nextStageId: string;
  semesterId: string;
  nextSemesterId: string;
}> {
  const track = await seedTrackFixture();
  const stages = await seedStageFixtures(track.id);
  const semesters = await seedSemesterFixtures();

  return {
    stageId: stages.stageId,
    nextStageId: stages.nextStageId,
    semesterId: semesters.semesterId,
    nextSemesterId: semesters.nextSemesterId,
  };
}

async function seedTrackFixture(): Promise<{ id: string }> {
  const productLine = await db.productLine.create({
    data: {
      key: "gre29_class_line",
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

  return track;
}

async function seedStageFixtures(
  trackId: string,
): Promise<{ stageId: string; nextStageId: string }> {
  const stage = await db.stage.create({
    data: {
      trackId,
      name: `${TEST_PREFIX}Stage One`,
      internalCode: "GRE29S1",
      sequence: 1,
    },
  });
  const nextStage = await db.stage.create({
    data: {
      trackId,
      name: `${TEST_PREFIX}Stage Two`,
      internalCode: "GRE29S2",
      sequence: 2,
    },
  });

  return { stageId: stage.id, nextStageId: nextStage.id };
}

async function seedSemesterFixtures(): Promise<{ semesterId: string; nextSemesterId: string }> {
  const semester = await db.semester.create({
    data: {
      name: `${TEST_PREFIX}2026.1`,
      startDate: new Date("2026-02-01"),
      endDate: new Date("2026-06-30"),
    },
  });
  const nextSemester = await db.semester.create({
    data: {
      name: `${TEST_PREFIX}2026.2`,
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-12-15"),
    },
  });

  return {
    semesterId: semester.id,
    nextSemesterId: nextSemester.id,
  };
}

export async function cleanClassDatabase(): Promise<void> {
  await db.classSession.deleteMany({
    where: { class: { internalCode: { startsWith: TEST_PREFIX } } },
  });
  await db.classScheduleSlot.deleteMany({
    where: { class: { internalCode: { startsWith: TEST_PREFIX } } },
  });
  await db.class.deleteMany({
    where: { internalCode: { startsWith: TEST_PREFIX } },
  });
  await db.semester.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  });
  await db.stage.deleteMany({
    where: { internalCode: { startsWith: "GRE29" } },
  });
  await db.track.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  });
  await db.productLine.deleteMany({
    where: { key: { startsWith: "gre29_class_" } },
  });
  await db.user.deleteMany({
    where: { id: TEACHER_USER_ID },
  });
}

export async function callHttpMutation(input: {
  path: string;
  body: unknown;
  queue?: SessionsGenerateQueue;
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
    createContext: () =>
      Promise.resolve(
        input.queue === undefined
          ? contextFor(input.staffUser ?? ADMIN)
          : contextWithQueue({
              queue: input.queue,
              ...optionalStaffUser(input.staffUser),
            }),
      ),
  });
}

function optionalStaffUser(staffUser: StaffUser | undefined): { staffUser?: StaffUser } {
  return staffUser === undefined ? {} : { staffUser };
}
