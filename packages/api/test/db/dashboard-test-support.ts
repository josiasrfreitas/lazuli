import { appRouter, createCaller, type Context, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

export const TEST_PREFIX = "GRE-64 Dashboard ";
export const ENDPOINT = "/api/trpc";
export const HTTP_OK = 200;
export const HTTP_FORBIDDEN = 403;

const SESSION_START_TIME = new Date("1970-01-01T14:00:00.000Z");
const SESSION_END_TIME = new Date("1970-01-01T16:00:00.000Z");

export const ADMIN: StaffUser = {
  id: "00000000-0000-0000-0000-000000640001",
  name: "Admin de Teste",
  email: "gre64-admin@example.com",
  role: "ADMIN",
  isEnabled: true,
};

export const TEACHER: StaffUser = {
  id: "00000000-0000-0000-0000-000000640002",
  name: "Professora de Teste",
  email: "gre64-teacher@example.com",
  role: "TEACHER",
  isEnabled: true,
};

export const OTHER_TEACHER: StaffUser = {
  id: "00000000-0000-0000-0000-000000640003",
  name: "Professora de Teste",
  email: "gre64-other-teacher@example.com",
  role: "TEACHER",
  isEnabled: true,
};

export type DashboardCaller = ReturnType<typeof createCaller>;

export function caller(staffUser: StaffUser = ADMIN, now?: Date): DashboardCaller {
  return createCaller(contextFor(staffUser, now));
}

export function contextFor(staffUser: StaffUser, now?: Date): Context {
  return { db, staffUser, ...(now === undefined ? {} : { now }) };
}

export async function ensureDashboardUsers(): Promise<void> {
  for (const user of [ADMIN, TEACHER, OTHER_TEACHER]) {
    await db.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email,
        name: `${TEST_PREFIX}${user.role}`,
        role: user.role,
        isEnabled: true,
      },
      update: {},
    });
  }
}

export async function seedStudent(input: {
  suffix: string;
  status?: "ACTIVE" | "INACTIVE" | "DROPPED" | "SUSPENDED";
  createdAt: Date;
}): Promise<string> {
  const student = await db.student.create({
    data: {
      fullName: `${TEST_PREFIX}${input.suffix}`,
      status: input.status ?? "ACTIVE",
      createdAt: input.createdAt,
    },
    select: { id: true },
  });

  return student.id;
}

export async function seedDashboardCatalog(): Promise<{ stageId: string; semesterId: string }> {
  const productLine = await db.productLine.create({
    data: {
      key: "gre64_dashboard_line",
      name: `${TEST_PREFIX}Line`,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  const track = await db.track.create({
    data: {
      productLineId: productLine.id,
      name: `${TEST_PREFIX}Track`,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  const stage = await db.stage.create({
    data: {
      trackId: track.id,
      name: `${TEST_PREFIX}Stage`,
      internalCode: "GRE64DASH",
      sequence: 1,
    },
    select: { id: true },
  });
  const semester = await db.semester.create({
    data: {
      name: `${TEST_PREFIX}2084.1`,
      startDate: new Date("2084-02-01T00:00:00.000Z"),
      endDate: new Date("2084-06-30T00:00:00.000Z"),
    },
    select: { id: true },
  });

  return { stageId: stage.id, semesterId: semester.id };
}

export async function seedClass(input: {
  code: string;
  teacherId: string;
  semesterId: string;
  stageId: string;
}): Promise<string> {
  const classRow = await db.class.create({
    data: {
      internalCode: `${TEST_PREFIX}${input.code}`,
      teacherId: input.teacherId,
      scheduleType: "REGULAR",
      format: "IN_PERSON",
      sharedStageId: input.stageId,
      semesterId: input.semesterId,
      year: 2084,
      capacity: 12,
      portalClassName: `${TEST_PREFIX}Portal ${input.code}`,
    },
    select: { id: true },
  });

  return classRow.id;
}

export async function seedSession(input: {
  classId: string;
  date: string;
  status?: "SCHEDULED" | "CANCELLED";
  attendanceConfirmedAt?: Date | null;
}): Promise<string> {
  const status = input.status ?? "SCHEDULED";
  const session = await db.classSession.create({
    data: {
      classId: input.classId,
      date: new Date(`${input.date}T00:00:00.000Z`),
      startTime: SESSION_START_TIME,
      endTime: SESSION_END_TIME,
      status,
      ...optionalAttendanceConfirmedAt(input.attendanceConfirmedAt),
      ...(status === "CANCELLED"
        ? { cancelReason: `${TEST_PREFIX}Cancelled`, cancelledAt: new Date() }
        : {}),
    },
    select: { id: true },
  });

  return session.id;
}

function optionalAttendanceConfirmedAt(attendanceConfirmedAt: Date | null | undefined): {
  attendanceConfirmedAt?: Date | null;
} {
  return attendanceConfirmedAt === undefined ? {} : { attendanceConfirmedAt };
}

export async function callHttpQuery(input: {
  path: string;
  staffUser: StaffUser;
  now?: Date;
}): Promise<Response> {
  return fetchRequestHandler({
    endpoint: ENDPOINT,
    req: new Request(`http://localhost${ENDPOINT}/${input.path}`, { method: "GET" }),
    router: appRouter,
    createContext: () => Promise.resolve(contextFor(input.staffUser, input.now)),
  });
}

export async function cleanDashboardDatabase(): Promise<void> {
  await db.classSession.deleteMany({
    where: { class: { internalCode: { startsWith: TEST_PREFIX } } },
  });
  await db.student.deleteMany({ where: { fullName: { startsWith: TEST_PREFIX } } });
  await db.class.deleteMany({ where: { internalCode: { startsWith: TEST_PREFIX } } });
  await db.semester.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await db.stage.deleteMany({
    where: { track: { productLine: { key: { startsWith: "gre64_dashboard_" } } } },
  });
  await db.track.deleteMany({
    where: { productLine: { key: { startsWith: "gre64_dashboard_" } } },
  });
  await db.productLine.deleteMany({ where: { key: { startsWith: "gre64_dashboard_" } } });
  await db.user.deleteMany({
    where: { id: { in: [ADMIN.id, TEACHER.id, OTHER_TEACHER.id] } },
  });
}
