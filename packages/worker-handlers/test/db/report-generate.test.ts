import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";
import { createArtifactStorageFromEnv, parseStorageEnvironment } from "@lazuli/integrations";

import { processReportGenerate } from "../../src/index.js";
import { ReportGenerationError } from "../../src/reports/report-error.js";

const TEST_PREFIX = "GRE-53 Reports ";
const TEACHER_ID = "00000000-0000-0000-0000-000000005350";
const NOW = new Date("2041-04-10T15:00:00.000Z");
const PDF_HEADER = "%PDF-";
const CENTS_450_00 = 45_000;
const CENTS_100_00 = 10_000;
const ENTRY_DATE = new Date("2041-03-01T00:00:00.000Z");
const SLOT_START = new Date("1970-01-01T18:00:00.000Z");
const SLOT_END = new Date("1970-01-01T19:30:00.000Z");

const storage = createArtifactStorageFromEnv();
const environment = parseStorageEnvironment();

type Fixtures = {
  studentAId: string;
  studentBId: string;
  classAId: string;
};

let fixtures: Fixtures;

void describe("report-generate handler against Postgres + fake-gcs", () => {
  void before(async () => {
    await db.$connect();
    await cleanDatabase();
    fixtures = await seedFixtures();
  });

  void after(async () => {
    await cleanDatabase();
    await db.$disconnect();
  });

  databaseIt("generates the overdue receivables CSV into the bucket", overdueCsvCase);
  databaseIt("generates the student statement PDF into the bucket", statementPdfCase);
  databaseIt("generates the attendance summary PDF for a bucketed enrollment", attendanceOkCase);
  databaseIt("fails the attendance summary when a session has no semester bucket", unbucketedCase);
  databaseIt("fails SIGNED_ORDER_PDF as unsupported while stamping the artifact", unsupportedCase);
  databaseIt("generates the class roster PDF for the seeded class", rosterPdfCase);
});

async function overdueCsvCase(): Promise<void> {
  const artifact = await db.generatedArtifact.create({
    data: { kind: "OVERDUE_RECEIVABLES_CSV" },
  });

  await runHandler(artifact.id);

  const row = await mustReloadArtifact(artifact.id);
  assert.notEqual(row.completedAt, null);
  assert.equal(row.failedAt, null);
  assert.equal(row.storageBucket, environment.gcsArtifactsBucket);
  assert.equal(row.storageObject, `reports/${artifact.id}/inadimplencia.csv`);
  assert.equal(row.contentType, "text/csv; charset=utf-8");
  assert.equal(row.fileName, "inadimplencia.csv");

  const csv = await fetchObjectText(row.storageObject ?? "");
  assert.match(csv, new RegExp(`${TEST_PREFIX}Aluno A`));
  assert.match(csv, /"450,00","100,00","350,00",31/);
}

async function statementPdfCase(): Promise<void> {
  const artifact = await db.generatedArtifact.create({
    data: { kind: "STUDENT_STATEMENT_PDF", studentId: fixtures.studentAId },
  });

  await runHandler(artifact.id);

  const row = await mustReloadArtifact(artifact.id);
  assert.notEqual(row.completedAt, null);
  assert.equal(row.contentType, "application/pdf");
  const pdfText = await fetchObjectText(row.storageObject ?? "");
  assert.equal(pdfText.startsWith(PDF_HEADER), true);
}

async function attendanceOkCase(): Promise<void> {
  const artifact = await db.generatedArtifact.create({
    data: { kind: "ATTENDANCE_SUMMARY_PDF", studentId: fixtures.studentAId },
  });

  await runHandler(artifact.id);

  const row = await mustReloadArtifact(artifact.id);
  assert.notEqual(row.completedAt, null);
  assert.equal(row.fileName, "resumo-de-frequencia.pdf");
}

async function unbucketedCase(): Promise<void> {
  const artifact = await db.generatedArtifact.create({
    data: { kind: "ATTENDANCE_SUMMARY_PDF", studentId: fixtures.studentBId },
  });

  await assert.rejects(
    runHandler(artifact.id),
    (error: unknown) =>
      error instanceof ReportGenerationError && error.code === "SETUP_ERROR_UNBUCKETED_SESSION",
  );

  const row = await mustReloadArtifact(artifact.id);
  assert.notEqual(row.failedAt, null);
  assert.equal(row.completedAt, null);
  assert.equal(row.errorCode, "SETUP_ERROR_UNBUCKETED_SESSION");
}

async function unsupportedCase(): Promise<void> {
  const artifact = await db.generatedArtifact.create({
    data: { kind: "SIGNED_ORDER_PDF" },
  });

  await assert.rejects(runHandler(artifact.id));

  const row = await mustReloadArtifact(artifact.id);
  assert.equal(row.errorCode, "SETUP_ERROR_UNSUPPORTED_KIND");
  assert.notEqual(row.failedAt, null);
}

async function rosterPdfCase(): Promise<void> {
  const artifact = await db.generatedArtifact.create({
    data: { kind: "CLASS_ROSTER_PDF", classId: fixtures.classAId },
  });

  await runHandler(artifact.id);

  const row = await mustReloadArtifact(artifact.id);
  assert.notEqual(row.completedAt, null);
  assert.equal(row.fileName, "lista-de-turma.pdf");
}

function runHandler(artifactId: string): Promise<{ artifactId: string }> {
  return processReportGenerate({
    payload: { artifactId },
    database: db,
    storage,
    now: NOW,
  });
}

async function mustReloadArtifact(id: string): Promise<{
  completedAt: Date | null;
  failedAt: Date | null;
  storageBucket: string | null;
  storageObject: string | null;
  contentType: string | null;
  fileName: string | null;
  errorCode: string | null;
}> {
  const row = await db.generatedArtifact.findUnique({ where: { id } });
  assert.notEqual(row, null);

  return row as NonNullable<typeof row>;
}

async function fetchObjectText(storageObject: string): Promise<string> {
  const response = await fetch(await storage.getSignedUrl(storageObject));
  assert.equal(response.ok, true);

  return response.text();
}

async function seedFixtures(): Promise<Fixtures> {
  await seedTeacher();
  const stageId = await seedCatalog();
  const semester = await seedSemester();
  const classA = await seedClass({ code: "A", semesterId: semester.id });
  const classB = await seedClass({ code: "B", semesterId: semester.id });
  const studentA = await seedStudent("Aluno A");
  const studentB = await seedStudent("Aluno B");
  await seedAttendanceScenario({ classId: classA.id, studentId: studentA.id, stageId });
  await seedUnbucketedScenario({ classId: classB.id, studentId: studentB.id, stageId });
  await seedFinanceScenario(studentA.id);

  return { studentAId: studentA.id, studentBId: studentB.id, classAId: classA.id };
}

async function seedCatalog(): Promise<string> {
  const productLine = await db.productLine.create({
    data: { key: "gre53_reports_line", name: `${TEST_PREFIX}Line`, status: "ACTIVE" },
  });
  const track = await db.track.create({
    data: { productLineId: productLine.id, name: `${TEST_PREFIX}Track`, status: "ACTIVE" },
  });
  const stage = await db.stage.create({
    data: { trackId: track.id, name: `${TEST_PREFIX}Stage`, internalCode: "GRE53S1", sequence: 1 },
  });

  return stage.id;
}

async function seedEnrollment(input: {
  classId: string;
  studentId: string;
  stageId: string;
}): Promise<{ id: string }> {
  return db.enrollment.create({
    data: {
      studentId: input.studentId,
      classId: input.classId,
      entryDate: ENTRY_DATE,
      progressRecords: {
        create: { stageId: input.stageId, startDate: ENTRY_DATE },
      },
    },
  });
}

async function seedTeacher(): Promise<void> {
  await db.user.create({
    data: {
      id: TEACHER_ID,
      email: "gre-53-teacher@example.com",
      name: `${TEST_PREFIX}Teacher`,
      role: "TEACHER",
      isEnabled: true,
    },
  });
}

async function seedSemester(): Promise<{ id: string }> {
  return db.semester.create({
    data: {
      name: `${TEST_PREFIX}2041.1`,
      startDate: ENTRY_DATE,
      endDate: new Date("2041-06-30T00:00:00.000Z"),
    },
  });
}

async function seedClass(input: { code: string; semesterId: string }): Promise<{ id: string }> {
  return db.class.create({
    data: {
      internalCode: `${TEST_PREFIX}Class ${input.code}`,
      teacherId: TEACHER_ID,
      scheduleType: "PERSONALIZED",
      format: "IN_PERSON",
      semesterId: input.semesterId,
      year: 2041,
      capacity: 10,
      portalClassName: `${TEST_PREFIX}Portal ${input.code}`,
      scheduleSlots: {
        create: {
          weekday: "MONDAY",
          startTime: SLOT_START,
          endTime: SLOT_END,
        },
      },
    },
  });
}

async function seedStudent(name: string): Promise<{ id: string }> {
  return db.student.create({
    data: { fullName: `${TEST_PREFIX}${name}`, status: "ACTIVE" },
  });
}

async function seedAttendanceScenario(input: {
  classId: string;
  studentId: string;
  stageId: string;
}): Promise<void> {
  const enrollment = await seedEnrollment(input);
  const plans = [
    { date: "2041-03-04", status: "PRESENT" },
    { date: "2041-03-11", status: "ABSENT" },
  ] as const;

  for (const plan of plans) {
    const session = await db.classSession.create({
      data: {
        classId: input.classId,
        date: new Date(`${plan.date}T00:00:00.000Z`),
        startTime: SLOT_START,
        endTime: SLOT_END,
        status: "SCHEDULED",
        attendanceConfirmedAt: new Date(`${plan.date}T22:00:00.000Z`),
      },
    });

    await db.attendance.create({
      data: {
        enrollmentId: enrollment.id,
        classSessionId: session.id,
        status: plan.status,
      },
    });
  }
}

async function seedUnbucketedScenario(input: {
  classId: string;
  studentId: string;
  stageId: string;
}): Promise<void> {
  await seedEnrollment(input);
  // A session after every seeded semester window: no bucket → setup error.
  await db.classSession.create({
    data: {
      classId: input.classId,
      date: new Date("2041-08-04T00:00:00.000Z"),
      startTime: SLOT_START,
      endTime: SLOT_END,
      status: "SCHEDULED",
    },
  });
}

async function seedFinanceScenario(studentId: string): Promise<void> {
  const payer = await db.payer.create({ data: { name: `${TEST_PREFIX}Pagador` } });
  const order = await db.order.create({
    data: {
      payerId: payer.id,
      kind: "TUITION",
      principalAmountCents: CENTS_450_00 * 2,
      startDate: ENTRY_DATE,
      dueDay: 10,
      beneficiaries: { create: { studentId } },
    },
  });
  const overdue = await db.installment.create({
    data: {
      orderId: order.id,
      amountCents: CENTS_450_00,
      dueDate: new Date("2041-03-10T00:00:00.000Z"),
    },
  });
  await db.installment.create({
    data: {
      orderId: order.id,
      amountCents: CENTS_450_00,
      dueDate: new Date("2041-05-10T00:00:00.000Z"),
    },
  });
  const entry = await db.paymentEntry.create({
    data: {
      payerId: payer.id,
      date: new Date("2041-04-05T00:00:00.000Z"),
      amountCents: CENTS_100_00,
      method: "PIX",
    },
  });
  await db.paymentAllocation.create({
    data: {
      paymentEntryId: entry.id,
      installmentId: overdue.id,
      amountCents: CENTS_100_00,
    },
  });
}

async function cleanDatabase(): Promise<void> {
  await db.generatedArtifact.deleteMany({
    where: { OR: [{ student: { fullName: { startsWith: TEST_PREFIX } } }, { studentId: null }] },
  });
  await db.paymentAllocation.deleteMany({
    where: { paymentEntry: { payer: { name: { startsWith: TEST_PREFIX } } } },
  });
  await db.paymentEntry.deleteMany({ where: { payer: { name: { startsWith: TEST_PREFIX } } } });
  await db.installment.deleteMany({
    where: { order: { payer: { name: { startsWith: TEST_PREFIX } } } },
  });
  await db.orderBeneficiary.deleteMany({
    where: { order: { payer: { name: { startsWith: TEST_PREFIX } } } },
  });
  await db.order.deleteMany({ where: { payer: { name: { startsWith: TEST_PREFIX } } } });
  await db.payer.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await db.attendance.deleteMany({
    where: { enrollment: { student: { fullName: { startsWith: TEST_PREFIX } } } },
  });
  await db.pedagogicalProgress.deleteMany({
    where: { enrollment: { student: { fullName: { startsWith: TEST_PREFIX } } } },
  });
  await db.enrollment.deleteMany({
    where: { student: { fullName: { startsWith: TEST_PREFIX } } },
  });
  await db.classSession.deleteMany({
    where: { class: { internalCode: { startsWith: TEST_PREFIX } } },
  });
  await db.classScheduleSlot.deleteMany({
    where: { class: { internalCode: { startsWith: TEST_PREFIX } } },
  });
  await db.class.deleteMany({ where: { internalCode: { startsWith: TEST_PREFIX } } });
  await db.student.deleteMany({ where: { fullName: { startsWith: TEST_PREFIX } } });
  await db.semester.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await db.stage.deleteMany({ where: { internalCode: "GRE53S1" } });
  await db.track.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await db.productLine.deleteMany({ where: { key: "gre53_reports_line" } });
  await db.user.deleteMany({ where: { id: TEACHER_ID } });
}
