import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { createCaller, teacherFileResource } from "@lazuli/api";
import { db } from "@lazuli/db";
import { evaluateStaffAccess } from "@lazuli/auth";

void it("shares registration and private attachments while teaching and account roles change independently", async () => {
  const suffix = randomUUID();
  const admin = await db.user.create({
    data: { name: "Cadastro Teste", email: `${suffix}-admin@example.test`, role: "ADMIN" },
  });
  const ctx = { db, staffUser: admin };
  const caller = createCaller(ctx);
  const email = `${suffix}@example.test`;
  const input = {
    name: "Equipe Teste",
    email,
    cpf: "77460292052",
    area: "SECRETARIAT",
    jobTitle: "Auxiliar",
    employmentType: "CLT",
    role: "ADMIN",
    teaches: false,
  } as const;
  const user = await db.user.create({
    data: { name: input.name, email, role: "ADMIN", isEnabled: false },
  });
  try {
    const session = await caller.teachers.uploads.create({});
    // Storage objects predate this operation. Linking moves their metadata without copying bytes.
    const files = await Promise.all(
      ["PHOTO", "OTHER", "OTHER"].map((kind) =>
        db.teacherFile.create({
          data: {
            uploadSessionId: session.id,
            kind,
            label: "Arquivo",
            fileName: "arquivo.png",
            contentType: "image/png",
            byteLength: 20,
            bucket: "test",
            key: randomUUID(),
          },
        }),
      ),
    );
    const linked = await caller.employees.save({
      ...input,
      role: "SECRETARY",
      documentSessionId: session.id,
    });
    assert.equal(linked.id, user.id);
    const employee = await caller.employees.byId({ id: user.id });
    assert.equal(employee.employeeProfile?.area, "SECRETARIAT");
    assert.equal(employee.role, "ADMIN");
    assert.equal(employee.isEnabled, false);
    await assert.rejects(caller.teachers.byId({ id: user.id }), /não encontrado/);
    const uploaded = await caller.teachers.files({ id: user.id });
    assert.deepEqual(
      uploaded.map((file) => file.id).toSorted(),
      files.map((file) => file.id).toSorted(),
    );
    const teaching = {
      ...input,
      id: user.id,
      teaches: true,
      isEnabled: true,
      notes: "Observações docentes",
    };
    await caller.employees.save(teaching);
    const detail = await caller.teachers.byId({ id: user.id });
    assert.equal(detail.employeeProfile?.jobTitle, "Auxiliar");
    assert.equal(detail.teacherProfile?.notes, teaching.notes);
    const vacationStart = new Date("2026-06-01");
    await db.teacherProfile.update({
      where: { userId: user.id },
      data: {
        vacationStart,
        vacationEnd: new Date("2026-06-07"),
        weeklyHours: 8,
        departureDate: new Date("2026-10-01"),
      },
    });
    await caller.employees.save({ ...teaching, employmentType: "PJ", jobTitle: "Coordenador" });
    const edited = await caller.teachers.byId({ id: user.id });
    assert.equal(edited.teacherProfile?.vacationStart?.getTime(), vacationStart.getTime());
    assert.equal(edited.teacherProfile?.weeklyHours, 8);
    assert.equal(edited.employeeProfile?.jobTitle, "Coordenador");
    assert.equal(evaluateStaffAccess(edited, new Date("2026-11-20")).allowed, true);
    await caller.employees.save({ ...teaching, isEnabled: false });
    const disabled = await caller.employees.byId({ id: user.id });
    assert.equal(disabled.isEnabled, false);
    await assert.rejects(
      caller.employees.save({ ...teaching, role: "SYSTEM_ADMIN" }),
      /papel de acesso/,
    );
    const restricted = { ...ctx, staffUser: { ...admin, role: "TEACHER" as const } };
    await assert.rejects(createCaller(restricted).employees.save(teaching), { code: "FORBIDDEN" });
    const forbidden = await teacherFileResource(restricted, {
      id: files[0]!.id,
      request: new Request("http://localhost/arquivo"),
    });
    assert.equal(forbidden.status, 403);
  } finally {
    await db.teacherFile.deleteMany({ where: { uploadSession: { createdById: admin.id } } });
    await db.teacherUploadSession.deleteMany({ where: { createdById: admin.id } });
    await db.activityEvent.deleteMany({ where: { actorId: admin.id } });
    await db.teacherProfile.deleteMany({ where: { userId: user.id } });
    await db.employeeProfile.deleteMany({ where: { userId: user.id } });
    await db.user.deleteMany({ where: { id: { in: [admin.id, user.id] } } });
    await db.$disconnect();
  }
});
