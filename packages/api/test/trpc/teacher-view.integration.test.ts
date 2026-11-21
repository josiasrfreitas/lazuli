import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { createCaller, createTRPCContext } from "@lazuli/api";
import type { StaffRole } from "@lazuli/auth";
import { db } from "@lazuli/db";

const forbidden = { code: "FORBIDDEN" };
const ids: string[] = [];

async function staff(role: StaffRole) {
  const id = randomUUID();
  const user = await db.user.create({
    data: { id, role, email: `view-${id}@example.test`, name: `Equipe ${id}` },
  });
  ids.push(id);
  return user;
}
async function caller(email: string, teacher?: string) {
  return createCaller(
    await createTRPCContext({
      db,
      session: { user: { email } },
      headers: new Headers(teacher ? { "x-lazuli-teacher": teacher } : {}),
    }),
  );
}

void describe("read-only teacher view", () => {
  after(async () => {
    await db.teacherProfile.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });
  it("resolves the teacher separately from the authenticated super administrator and rejects writes", async () => {
    const actor = await staff("SUPER_ADMIN");
    const teacher = await staff("ADMIN");
    await db.teacherProfile.create({ data: { userId: teacher.id } });
    const admin = await caller(actor.email);
    assert.ok(
      (await admin.teacherWorkspace.viewProfiles()).some((profile) => profile.id === teacher.id),
    );
    await admin.finance.readSettings();
    const view = await caller(actor.email, teacher.id);
    const identity = await view.me();
    assert.equal(identity.id, teacher.id);
    assert.equal(identity.role, "TEACHER");
    assert.equal(identity.viewer?.id, actor.id);
    assert.equal((await view.teacherWorkspace.home()).teacherName, teacher.name);
    await assert.rejects(view.finance.readSettings(), forbidden);
    await assert.rejects(
      view.attendance.confirmSession({ sessionId: randomUUID(), rows: [] }),
      forbidden,
    );
    await assert.rejects(
      view.assessments.save({
        progressId: randomUUID(),
        version: 0,
        grades: [
          {
            phase: "BLOCK_ONE",
            competence: "ORAL",
            score: 75,
            assessedOn: "2026-11-21",
            reason: null,
          },
        ],
      }),
      forbidden,
    );
    await db.teacherProfile.update({
      where: { userId: teacher.id },
      data: { departureDate: new Date("2020-01-01") },
    });
    assert.ok(
      !(await admin.teacherWorkspace.viewProfiles()).some((profile) => profile.id === teacher.id),
    );
    await assert.rejects(caller(actor.email, teacher.id), forbidden);
    const disabled = await staff("TEACHER");
    await db.user.update({ where: { id: disabled.id }, data: { isEnabled: false } });
    await assert.rejects(caller(actor.email, disabled.id), forbidden);
  });
  it("denies the selector and direct target selection to other enabled roles", async () => {
    const teacher = await staff("TEACHER");
    for (const role of ["ADMIN", "SYSTEM_ADMIN", "TEACHER"] as const) {
      const actor = await staff(role);
      await assert.rejects((await caller(actor.email)).teacherWorkspace.viewProfiles(), forbidden);
      await assert.rejects(caller(actor.email, teacher.id), forbidden);
    }
  });
});
