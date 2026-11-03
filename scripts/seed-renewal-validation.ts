/** One local renewal scenario; keeps every existing student and contract intact. */
import { randomUUID } from "node:crypto";
import { createDbClient, type TransactionClient } from "../packages/db/src/client.js";
import { getDatabaseUrl } from "../packages/db/src/config.js";
import { saoPauloTodayIso } from "../packages/db/src/seed-dev-support.js";
import { addCalendarMonths } from "../packages/domain/src/monthly-contract.js";
import { finance } from "../packages/api/src/finance/index.js";

const url = new URL(getDatabaseUrl());
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.pathname !== "/lazuli_refactor_inicio"
)
  throw new Error("Este cenário pertence apenas ao banco local lazuli_refactor_inicio.");

const database = createDbClient();
const today = saoPauloTodayIso();
const MILLISECONDS_PER_DAY = 86_400_000;
const ISO_DAY_END = 10;
const RENEWAL_LEAD_DAYS = 21;
const PREVIOUS_CONTRACT_MONTHS = -6;
const FIRST_HALF_END_MONTH = 6;
const MONTH_END_INDEX = 7;
const YEAR_END_INDEX = 4;
const STUDENT_AGE = 29;
const PREVIOUS_ENTRY_DAYS = 10;
const AGREEMENT_DAYS_BEFORE_START = -9;
const ONE_YEAR = 1;
const FIRST_HALF = 1;
const SECOND_HALF = 2;
const CONTRACT_MONTHS = 6;
const SCHOLARSHIP_PCT = 75;
const MONTHLY_AMOUNT_CENTS = 100_000;
const STUDENT_NAME = "Fernanda Oliveira";
const date = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const days = (value: string, offset: number): string =>
  new Date(date(value).getTime() + offset * MILLISECONDS_PER_DAY)
    .toISOString()
    .slice(0, ISO_DAY_END);
const endingOn = days(today, RENEWAL_LEAD_DAYS);
const startingOn = addCalendarMonths(endingOn, PREVIOUS_CONTRACT_MONTHS);
const currentYear = Number(today.slice(0, YEAR_END_INDEX));
const currentHalf =
  Number(today.slice(YEAR_END_INDEX + 1, MONTH_END_INDEX)) <= FIRST_HALF_END_MONTH
    ? FIRST_HALF
    : SECOND_HALF;
const currentName = `${currentYear}.${currentHalf}`;
const previousName =
  currentHalf === FIRST_HALF
    ? `${currentYear - ONE_YEAR}.${SECOND_HALF}`
    : `${currentYear}.${FIRST_HALF}`;

try {
  const existing = await database.student.findFirst({
    where: { fullName: STUDENT_NAME, deletedAt: null },
  });
  if (existing) throw new Error("Fernanda Oliveira já existe; nenhum registro foi alterado.");
  const [admin, currentClass, previousClass, stage, currentSemester, previousSemester] =
    await Promise.all([
      database.user.findFirstOrThrow({
        where: { email: "dev@lazuli.local", role: "ADMIN", deletedAt: null },
      }),
      database.class.findFirstOrThrow({
        where: { semester: { name: currentName }, sharedStage: { internalCode: "E1" } },
      }),
      database.class.findFirstOrThrow({
        where: { semester: { name: previousName }, sharedStage: { internalCode: "E1" } },
      }),
      database.stage.findFirstOrThrow({ where: { internalCode: "E1" } }),
      database.period.findUniqueOrThrow({ where: { name: currentName } }),
      database.period.findUniqueOrThrow({ where: { name: previousName } }),
    ]);

  const result = await database.$transaction(
    async (tx) => {
      const studentId = await seedEnrollmentHistory(tx, {
        adminId: admin.id,
        currentClassId: currentClass.id,
        previousClassId: previousClass.id,
        stageId: stage.id,
        currentStart: currentSemester.startDate,
        previousStart: previousSemester.startDate,
        previousEnd: previousSemester.endDate,
      });
      return seedContractPayments(tx, { studentId, adminId: admin.id });
    },
    { timeout: 90_000 },
  );
  process.stdout.write(`${JSON.stringify({ name: STUDENT_NAME, endingOn, ...result }, null, 2)}\n`);
} finally {
  await database.$disconnect();
}

type EnrollmentSeedInput = {
  adminId: string;
  currentClassId: string;
  previousClassId: string;
  stageId: string;
  currentStart: Date;
  previousStart: Date;
  previousEnd: Date;
};

async function recordEnrollment(
  tx: TransactionClient,
  input: { id: string; entryDate: Date; exitDate: Date | null; stageId: string; adminId: string },
): Promise<void> {
  await tx.enrollmentAction.create({
    data: {
      enrollmentId: input.id,
      kind: "ENTRY",
      status: "APPLIED",
      effectiveDate: input.entryDate,
      recordedById: input.adminId,
    },
  });
  await tx.pedagogicalProgress.create({
    data: {
      enrollmentId: input.id,
      stageId: input.stageId,
      startDate: input.entryDate,
      ...(input.exitDate ? { endDate: input.exitDate, endReason: "TRANSFERRED" as const } : {}),
    },
  });
}

async function seedEnrollmentHistory(
  tx: TransactionClient,
  input: EnrollmentSeedInput,
): Promise<string> {
  const student = await tx.student.create({
    data: {
      fullName: STUDENT_NAME,
      birthDate: date(`${currentYear - STUDENT_AGE}-09-14`),
      notes: "Prefere manter as aulas de terça e quinta no período da noite.",
    },
  });
  const priorEntry = date(
    days(input.previousStart.toISOString().slice(0, ISO_DAY_END), PREVIOUS_ENTRY_DAYS),
  );
  const oldEnrollment = await tx.enrollment.create({
    data: {
      studentId: student.id,
      classId: input.previousClassId,
      entryDate: priorEntry,
      exitDate: input.previousEnd,
      exitReason: "COMPLETED",
    },
  });
  const currentEnrollment = await tx.enrollment.create({
    data: { studentId: student.id, classId: input.currentClassId, entryDate: input.currentStart },
  });
  for (const enrollment of [oldEnrollment, currentEnrollment])
    await recordEnrollment(tx, { ...enrollment, stageId: input.stageId, adminId: input.adminId });
  await tx.enrollmentAction.create({
    data: {
      enrollmentId: oldEnrollment.id,
      kind: "EXIT",
      status: "APPLIED",
      effectiveDate: input.previousEnd,
      recordedById: input.adminId,
    },
  });
  return student.id;
}

async function seedContractPayments(
  tx: TransactionClient,
  input: { studentId: string; adminId: string },
): Promise<{ studentId: string; contractId: string; paidInstallments: number }> {
  const payer = await tx.payer.create({ data: { name: STUDENT_NAME } });
  const api = finance(tx, input.adminId);
  const contract = await api.createMonthlyContract({
    commandId: randomUUID(),
    studentId: input.studentId,
    payerId: payer.id,
    agreedOn: days(startingOn, AGREEMENT_DAYS_BEFORE_START),
    startsOn: startingOn,
    durationMonths: CONTRACT_MONTHS,
    firstDueDate: startingOn,
    monthlyAmountCents: MONTHLY_AMOUNT_CENTS,
    scholarshipPct: SCHOLARSHIP_PCT,
    scholarshipAgreement: "Bolsa comercial acordada com a escola.",
  });
  const installments = await tx.installment.findMany({
    where: { order: { contractId: contract.id } },
    orderBy: { sequenceNumber: "asc" },
  });
  for (const installment of installments) {
    if (installment.dueDate > date(today)) continue;
    await api.registerPayment({
      commandId: randomUUID(),
      payerId: payer.id,
      date: installment.dueDate,
      amountCents: installment.amountCents,
      method: "PIX",
      allocations: [{ installmentId: installment.id, amountCents: installment.amountCents }],
    });
  }
  return {
    studentId: input.studentId,
    contractId: contract.id,
    paidInstallments: installments.length,
  };
}
