import { appRouter, createCaller, type Context, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

export const TEST_PREFIX = "GRE-28 Calendar ";
export const HTTP_OK = 200;
export const ENDPOINT = "/api/trpc";
const TEST_YEAR_MIN = "2031-01-01";
const TEST_YEAR_MAX = "2035-12-31";
const FUTURE_TEST_DATE_MIN = "2099-01-01";
const FUTURE_TEST_DATE_MAX = "2099-12-31";

export const ADMIN: StaffUser = {
  id: "00000000-0000-0000-0000-0000000028ad",
  email: "gre-28-admin@example.com",
  role: "ADMIN",
  isEnabled: true,
};

export const TEACHER: StaffUser = {
  id: "00000000-0000-0000-0000-0000000028ed",
  email: "gre-28-teacher@example.com",
  role: "TEACHER",
  isEnabled: true,
};

export type CalendarCaller = ReturnType<typeof createCaller>;

export function caller(staffUser: StaffUser | null = ADMIN): CalendarCaller {
  return createCaller(contextFor(staffUser));
}

export function contextFor(staffUser: StaffUser | null): Context {
  return { db, staffUser };
}

export async function ensureCalendarUsers(): Promise<void> {
  await Promise.all([upsertUser(ADMIN), upsertUser(TEACHER)]);
}

export async function cleanCalendarDatabase(): Promise<void> {
  await db.schoolClosedDay.deleteMany({
    where: { reason: { startsWith: TEST_PREFIX } },
  });
  await db.schoolClosedDay.deleteMany({
    where: { createdById: { in: [ADMIN.id, TEACHER.id] } },
  });
  await db.$executeRaw`
    DELETE FROM "SchoolClosedDay"
    WHERE "date" BETWEEN CAST(${TEST_YEAR_MIN} AS date) AND CAST(${TEST_YEAR_MAX} AS date)
  `;
  await db.$executeRaw`
    DELETE FROM "SchoolClosedDay"
    WHERE "date" BETWEEN CAST(${FUTURE_TEST_DATE_MIN} AS date) AND CAST(${FUTURE_TEST_DATE_MAX} AS date)
  `;
}

export async function callHttpMutation(input: {
  path: string;
  body: unknown;
  staffUser?: StaffUser | null;
}): Promise<Response> {
  const staffUser = Object.hasOwn(input, "staffUser") ? (input.staffUser ?? null) : ADMIN;

  return fetchRequestHandler({
    endpoint: ENDPOINT,
    req: new Request(`http://localhost${ENDPOINT}/${input.path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: input.body }),
    }),
    router: appRouter,
    createContext: () => Promise.resolve(contextFor(staffUser)),
  });
}

async function upsertUser(user: StaffUser): Promise<void> {
  await db.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email,
      name: user.role === "ADMIN" ? "GRE-28 Admin" : "GRE-28 Teacher",
      role: user.role,
      isEnabled: user.isEnabled,
    },
    update: {
      email: user.email,
      role: user.role,
      isEnabled: user.isEnabled,
    },
  });
}
