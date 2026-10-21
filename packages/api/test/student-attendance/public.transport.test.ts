import assert from "node:assert/strict";
import { beforeEach, after, it } from "node:test";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@lazuli/api";
import { db } from "@lazuli/db";
import {
  cleanDeclarations,
  declarationFixture,
  declarationCaller,
} from "../support/student-attendance.js";
beforeEach(cleanDeclarations);
after(async () => {
  await cleanDeclarations();
  await db.$disconnect();
});
const endpoint = "/api/trpc";
function anonymousPost(path: string, input: object): Promise<Response> {
  return fetchRequestHandler({
    endpoint,
    router: appRouter,
    req: new Request(`http://localhost${endpoint}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: input }),
    }),
    createContext: () =>
      Promise.resolve({ db, staffUser: null, now: new Date("2077-03-10T12:05:00Z") }),
  });
}
void it("serves an anonymous capability by POST while withholding staff controls and roster details", async () => {
  const fixture = await declarationFixture(true);
  const opened = await declarationCaller().studentAttendance.open({
    sessionId: fixture.session.id,
    minutes: 10,
    location: null,
  });
  const response = await anonymousPost("studentAttendance.inspect", { token: opened.token });
  const payload = (await response.json()) as {
    result: { data: { json: { className: string; format: string; expiresAt: string } } };
  };
  assert.equal(response.status, 200);
  assert.equal(payload.result.data.json.className, "Declare182 portal-A");
  assert.equal(payload.result.data.json.format, "ONLINE");
  assert.equal(payload.result.data.json.expiresAt, "2077-03-10T12:15:00.000Z");
  assert.doesNotMatch(JSON.stringify(payload), /Declare182 Ana|tokenHash|phone|enrollmentId/u);
  const denied = await anonymousPost("studentAttendance.open", {
    sessionId: fixture.session.id,
    minutes: 10,
    location: null,
  });
  assert.equal(denied.status, 401);
  const body = (await denied.json()) as { error: { json: { data: { code: string } } } };
  assert.equal(body.error.json.data.code, "UNAUTHORIZED");
  const receipt = await anonymousPost("studentAttendance.submit", {
    token: opened.token,
    name: fixture.students[0]!.name,
    enrollmentId: fixture.students[0]!.enrollmentId,
    browserId: "00000000-0000-4000-8000-000000001822",
    location: null,
  });
  assert.equal(receipt.status, 200);
  const receiptBody = (await receipt.json()) as {
    result: { data: { json: { name: string; repeated: boolean; submittedAt: string } } };
  };
  assert.deepEqual(receiptBody.result.data.json, {
    name: "Declare182 Ana Silva",
    repeated: false,
    submittedAt: "2077-03-10T12:05:00.000Z",
  });
  const saved = await db.attendanceDeclaration.findFirstOrThrow({
    where: { classSessionId: fixture.session.id },
  });
  assert.equal(saved.enrollmentId, fixture.students[0]!.enrollmentId);
  assert.equal(saved.submittedAt.toISOString(), "2077-03-10T12:05:00.000Z");
  assert.equal(await db.attendance.count({ where: { classSessionId: fixture.session.id } }), 0);
});
