import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { adminProcedure, createTRPCContext, router } from "@lazuli/api";
import type { StaffRole, StaffSession } from "@lazuli/auth";
import { db } from "@lazuli/db";

const ENDPOINT = "/api/trpc";
const PREFIX = "api-rbac-http-";
const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const createdEmails: string[] = [];

/**
 * The real BFF boundary: an ADMIN-only procedure mounted on the same fetch adapter the
 * Next.js route uses. Exercising it through HTTP proves the §5.2 acceptance criterion
 * end to end — session -> DB-resolved `ctx.staffUser` -> role gate -> HTTP status.
 */
const httpRouter = router({
  adminOnly: adminProcedure.query(() => ({ ok: true })),
});

/** Issues a real GET request for `adminOnly`, resolving context exactly as the route does. */
function callAdminOnly(session: StaffSession | null): Promise<Response> {
  return fetchRequestHandler({
    endpoint: ENDPOINT,
    req: new Request(`http://localhost${ENDPOINT}/adminOnly`, { method: "GET" }),
    router: httpRouter,
    createContext: () => createTRPCContext({ db, session }),
  });
}

void describe("RBAC over the tRPC HTTP boundary", () => {
  void before(async () => {
    await db.$connect();
  });

  void after(async () => {
    await db.user.deleteMany({ where: { email: { in: createdEmails } } });
    await db.$disconnect();
  });

  void it("admin gets 200, teacher gets 403, anonymous gets 401", async () => {
    const admin = await createUser("ADMIN");
    const teacher = await createUser("TEACHER");

    const adminResponse = await callAdminOnly(sessionFor(admin.email));
    const teacherResponse = await callAdminOnly(sessionFor(teacher.email));
    const anonResponse = await callAdminOnly(null);

    assert.equal(adminResponse.status, HTTP_OK);
    const adminPayload = (await adminResponse.json()) as {
      result: { data: { json: { ok: boolean } } };
    };
    assert.equal(adminPayload.result.data.json.ok, true);
    assert.equal(teacherResponse.status, HTTP_FORBIDDEN);
    assert.equal(anonResponse.status, HTTP_UNAUTHORIZED);
  });
});

async function createUser(role: StaffRole): Promise<{ email: string }> {
  const email = `${PREFIX}${randomUUID()}@example.com`;
  createdEmails.push(email);
  await db.user.create({ data: { email, name: "Equipe Teste", role, isEnabled: true } });
  return { email };
}

function sessionFor(email: string): StaffSession {
  return { user: { email } };
}
