import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe } from "node:test";

import { config as loadEnvironment } from "dotenv";

import { databaseIt } from "@lazuli/db/test";

loadEnvironment({ path: new URL("../../../../.env", import.meta.url), quiet: true });

const { createDbClient } = await import("@lazuli/db");

const SESSION_TEST_DURATION_MS = 60_000;

void describe("auth persistence schema", () => {
  const database = createDbClient();
  const email = `auth-schema-${randomUUID()}@example.com`;
  let userId: string | undefined;

  void before(async () => {
    await database.$connect();
  });

  void after(async () => {
    await cleanCreatedUser(database, userId);
    await database.$disconnect();
  });

  databaseIt("stores pre-provisioned staff beside Better Auth adapter rows", async () => {
    const user = await createEnabledTeacher(database, email);
    userId = user.id;

    await database.account.create({
      data: {
        accountId: `google-${randomUUID()}`,
        providerId: "google",
        userId: user.id,
      },
    });

    const session = await database.session.create({
      data: {
        expiresAt: new Date(Date.now() + SESSION_TEST_DURATION_MS),
        token: `session-${randomUUID()}`,
        userId: user.id,
      },
    });

    assert.equal(session.userId, user.id);
  });

  databaseIt("filters soft-deleted product users without filtering adapter rows", async () => {
    const id = requireUserId(userId);

    await database.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    const visibleUsers = await database.user.findMany({ where: { id } });
    const visibleSessions = await database.session.findMany({ where: { userId: id } });

    assert.deepEqual(visibleUsers, []);
    assert.equal(visibleSessions.length, 1);
  });
});

type Database = ReturnType<typeof createDbClient>;

async function createEnabledTeacher(database: Database, email: string): Promise<{ id: string }> {
  return database.user.create({
    data: {
      email,
      name: "Professora Teste",
      role: "TEACHER",
      isEnabled: true,
    },
  });
}

async function cleanCreatedUser(database: Database, userId: string | undefined): Promise<void> {
  if (userId === undefined) {
    return;
  }

  await database.session.deleteMany({ where: { userId } });
  await database.account.deleteMany({ where: { userId } });
  await database.user.deleteMany({ where: { id: userId } });
}

function requireUserId(userId: string | undefined): string {
  if (userId === undefined) {
    throw new Error("Expected test user to be created first");
  }

  return userId;
}
