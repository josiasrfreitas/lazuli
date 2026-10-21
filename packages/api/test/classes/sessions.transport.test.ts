import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { appRouter, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import {
  ADMIN,
  caller,
  cleanClassDatabase,
  contextFor,
  ensureTeacherUser,
  seedClassCatalogFixtures,
  TEACHER_USER_ID,
} from "../support/class-test-support.js";

void before(async () => {
  await db.$connect();
});
void after(async () => {
  await cleanClassDatabase();
  await db.$disconnect();
});

void it("scopes and paginates prepared encounters through the HTTP adapter", async () => {
  await cleanClassDatabase();
  await ensureTeacherUser();
  const fixtures = await seedClassCatalogFixtures();
  const first = await caller().classes.create({
    teacherId: TEACHER_USER_ID,
    scheduleType: "REGULAR",
    format: "IN_PERSON",
    sharedStageId: fixtures.stageId,
    semesterId: fixtures.semesterId,
    slots: [{ weekday: "TUESDAY", startTime: "14:00", endTime: "16:00" }],
  });
  const other = await caller().classes.create({
    teacherId: TEACHER_USER_ID,
    scheduleType: "PERSONALIZED",
    format: "ONLINE",
    semesterId: fixtures.semesterId,
    slots: [{ weekday: "FRIDAY", startTime: "10:00", endTime: "11:00" }],
  });
  await db.classSession.createMany({
    data: [
      {
        classId: first.id,
        date: new Date("2026-03-02"),
        startTime: new Date("1970-01-01T14:00:00Z"),
        endTime: new Date("1970-01-01T16:00:00Z"),
      },
      {
        classId: first.id,
        date: new Date("2026-03-01"),
        startTime: new Date("1970-01-01T14:00:00Z"),
        endTime: new Date("1970-01-01T16:00:00Z"),
      },
      {
        classId: other.id,
        date: new Date("2026-03-01"),
        startTime: new Date("1970-01-01T10:00:00Z"),
        endTime: new Date("1970-01-01T11:00:00Z"),
      },
    ],
  });
  const response = await query({
    path: "classes.sessions",
    values: { id: first.id, page: 1, pageSize: 1 },
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    result: {
      data: {
        json: {
          rows: { id: string; date: string; startTime: string; status: string }[];
          total: number;
          pageCount: number;
        };
      };
    };
  };
  assert.equal(payload.result.data.json.total, 2);
  assert.equal(payload.result.data.json.pageCount, 2);
  assert.deepEqual(
    payload.result.data.json.rows.map((row) => [row.date, row.startTime, row.status]),
    [["2026-03-01T00:00:00.000Z", "1970-01-01T14:00:00.000Z", "SCHEDULED"]],
  );
  const second = await query({
    path: "classes.sessions",
    values: { id: first.id, page: 2, pageSize: 1 },
  });
  const next = (await second.json()) as typeof payload;
  assert.equal(second.status, 200);
  assert.deepEqual(
    next.result.data.json.rows.map((row) => row.date),
    ["2026-03-02T00:00:00.000Z"],
  );
  const teacher: StaffUser = { ...ADMIN, id: TEACHER_USER_ID, role: "TEACHER" };
  for (const path of ["classes.sessions", "classes.generation"] as const) {
    const denied = await query({ path, values: { id: first.id }, actor: teacher });
    assert.equal(denied.status, 403, path);
    const body = (await denied.json()) as { error: { json: { data: { code: string } } } };
    assert.equal(body.error.json.data.code, "FORBIDDEN", path);
  }
});

function query(input: {
  path: "classes.sessions" | "classes.generation";
  values: { id: string; page?: number; pageSize?: number };
  actor?: StaffUser;
}): Promise<Response> {
  const encoded = encodeURIComponent(JSON.stringify({ json: input.values }));
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req: new Request(`http://localhost/api/trpc/${input.path}?input=${encoded}`),
    createContext: () => contextFor(input.actor ?? ADMIN),
  });
}
