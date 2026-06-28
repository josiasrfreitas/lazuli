import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe } from "node:test";

import { createCaller, createTRPCContext, type StaffUser } from "@lazuli/api";
import type { StaffRole, StaffSession } from "@lazuli/auth";
import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

const CONTEXT_PREFIX = "api-context-";
const UNAUTHORIZED = /UNAUTHORIZED/;
const createdEmails: string[] = [];

void describe("createTRPCContext staff resolution", () => {
  void before(async () => {
    await db.$connect();
  });

  void after(async () => {
    await db.user.deleteMany({ where: { email: { in: createdEmails } } });
    await db.$disconnect();
  });

  registerEnabledStaffTest();
  registerDeniedStaffTest();
  registerProtectedSeamTest();
});

function registerEnabledStaffTest(): void {
  databaseIt("populates staffUser with User.id for enabled ADMIN and TEACHER", async () => {
    for (const role of ["ADMIN", "TEACHER"] as const) {
      const user = await createUser({ role });
      const context = await createTRPCContext({ db, session: sessionFor(user.email) });

      assert.deepEqual(context.staffUser, {
        id: user.id,
        email: user.email,
        role,
        isEnabled: true,
      });
    }
  });
}

function registerDeniedStaffTest(): void {
  databaseIt("resolves staffUser to null for unknown, disabled, or not-enabled users", async () => {
    const disabled = await createUser({ role: "TEACHER", isEnabled: false });
    const secretary = await createUser({ role: "SECRETARY" });

    await assertNoStaffUser(sessionFor(randomEmail()));
    await assertNoStaffUser(sessionFor(disabled.email));
    await assertNoStaffUser(sessionFor(secretary.email));
    await assertNoStaffUser(null);
  });
}

function registerProtectedSeamTest(): void {
  databaseIt("protectedProcedure rejects null staff and resolves enabled staff", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const enabledContext = await createTRPCContext({ db, session: sessionFor(admin.email) });
    const anonymousContext = await createTRPCContext({ db, session: null });

    const result: StaffUser | null = await createCaller(enabledContext).me();

    assert.equal(result?.id, admin.id);
    await assert.rejects(createCaller(anonymousContext).me(), UNAUTHORIZED);
  });
}

async function assertNoStaffUser(session: StaffSession | null): Promise<void> {
  const context = await createTRPCContext({ db, session });
  assert.equal(context.staffUser, null);
}

async function createUser(input: {
  role: StaffRole;
  isEnabled?: boolean;
}): Promise<{ email: string; id: string }> {
  const email = randomEmail();
  createdEmails.push(email);
  const user = await db.user.create({
    data: { email, name: "Equipe Teste", role: input.role, isEnabled: input.isEnabled ?? true },
  });
  return { email, id: user.id };
}

function sessionFor(email: string): StaffSession {
  return { user: { email } };
}

function randomEmail(): string {
  return `${CONTEXT_PREFIX}${randomUUID()}@example.com`;
}
