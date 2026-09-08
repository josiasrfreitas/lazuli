import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { createCaller, createTRPCContext, type StaffUser } from "@lazuli/api";
import type { StaffRole, StaffSession } from "@lazuli/auth";
import { db } from "@lazuli/db";

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
  registerNoSessionTest();
});

function registerEnabledStaffTest(): void {
  void it("populates staffUser with User.id for enabled ADMIN and TEACHER", async () => {
    for (const role of ["ADMIN", "TEACHER"] as const) {
      const user = await createUser({ role });
      const context = await createTRPCContext({ db, session: sessionFor(user.email) });

      assert.deepEqual(context.staffUser, {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        isEnabled: true,
      });
    }
  });
}

function registerDeniedStaffTest(): void {
  void it("resolves staffUser to null for unknown, disabled, or not-enabled users", async () => {
    const disabled = await createUser({ role: "TEACHER", isEnabled: false });
    const secretary = await createUser({ role: "SECRETARY" });

    const staffUsers = await Promise.all([
      staffUserFor(sessionFor(randomEmail())),
      staffUserFor(sessionFor(disabled.email)),
      staffUserFor(sessionFor(secretary.email)),
      staffUserFor(null),
    ]);

    assert.deepEqual(staffUsers, [null, null, null, null]);
  });
}

function registerProtectedSeamTest(): void {
  void it("protectedProcedure rejects null staff and resolves enabled staff", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const enabledContext = await createTRPCContext({ db, session: sessionFor(admin.email) });
    const anonymousContext = await createTRPCContext({ db, session: null });

    const result: StaffUser | null = await createCaller(enabledContext).me();

    assert.equal(result?.id, admin.id);
    await assert.rejects(createCaller(anonymousContext).me(), UNAUTHORIZED);
  });
}

/**
 * There is no environment in which a missing session still resolves a staff user:
 * the development sign-in shortcut was retired with the login screen.
 */
function registerNoSessionTest(): void {
  void it("resolves no staff user without a session, whatever the environment holds", async () => {
    await createUser({ role: "ADMIN" });

    const context = await createTRPCContext({ db, session: null });

    assert.equal(context.staffUser, null);
  });
}

async function staffUserFor(session: StaffSession | null): Promise<StaffUser | null> {
  const context = await createTRPCContext({ db, session });
  return context.staffUser;
}

async function createUser(input: {
  role: StaffRole;
  isEnabled?: boolean;
}): Promise<{ email: string; id: string; name: string }> {
  const email = randomEmail();
  createdEmails.push(email);
  const user = await db.user.create({
    data: { email, name: "Equipe Teste", role: input.role, isEnabled: input.isEnabled ?? true },
  });
  return { email, id: user.id, name: user.name };
}

function sessionFor(email: string): StaffSession {
  return { user: { email } };
}

function randomEmail(): string {
  return `${CONTEXT_PREFIX}${randomUUID()}@example.com`;
}
