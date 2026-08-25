import { appRouter, createCaller, type Context, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

export const HTTP_TEST_PREFIX = "GRE-20 HTTP ";
export const TEST_PREFIX = "GRE-20 Student ";
export const ADULT_BIRTH_DATE = "1992-05-10";
export const ADULT_BIRTH_DATE_OBJECT = new Date("1992-05-10T00:00:00.000Z");
export const MINOR_BIRTH_DATE_OBJECT = new Date("2020-01-01T00:00:00.000Z");
export const HTTP_OK = 200;

const ENDPOINT = "/api/trpc";

export const ADMIN: StaffUser = {
  id: "00000000-0000-0000-0000-0000000000ad",
  name: "Admin de Teste",
  email: "admin@example.com",
  role: "ADMIN",
  isEnabled: true,
};

export type StudentCaller = ReturnType<typeof createCaller>;

export function caller(): StudentCaller {
  return createCaller(contextFor(ADMIN));
}

export function contextFor(staffUser: StaffUser): Context {
  return { db, staffUser };
}

export async function createAdultFixture(): Promise<{ id: string }> {
  return db.student.create({
    data: {
      fullName: `${TEST_PREFIX}Profile Adult`,
      phone: "(82) 99999-0000",
      birthDate: ADULT_BIRTH_DATE_OBJECT,
      notes: "Aluno prefere horario da tarde.",
    },
  });
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
  body: unknown;
  staffUser: StaffUser;
}): Promise<Response> {
  const url = new URL(`http://localhost${ENDPOINT}/${input.path}`);
  url.searchParams.set("input", JSON.stringify({ json: input.body }));

  return fetchRequestHandler({
    endpoint: ENDPOINT,
    req: new Request(url, { method: "GET" }),
    router: appRouter,
    createContext: () => Promise.resolve(contextFor(input.staffUser)),
  });
}

export async function cleanDatabase(prefix = TEST_PREFIX): Promise<void> {
  const students = await db.student.findMany({
    where: { fullName: { startsWith: prefix } },
    select: { id: true, addressId: true, guardianId: true },
  });
  const guardianIds = students.flatMap((student) =>
    student.guardianId === null ? [] : [student.guardianId],
  );
  const addressIds = students.flatMap((student) =>
    student.addressId === null ? [] : [student.addressId],
  );

  await db.student.deleteMany({ where: { id: { in: students.map((student) => student.id) } } });
  await db.guardian.deleteMany({
    where: {
      OR: [{ id: { in: guardianIds } }, { fullName: { startsWith: prefix } }],
    },
  });
  await db.address.deleteMany({
    where: {
      id: { in: addressIds },
    },
  });
}
