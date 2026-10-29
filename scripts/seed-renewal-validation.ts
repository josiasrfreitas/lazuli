/** One local renewal scenario; keeps every existing student and contract intact. */
import { randomUUID } from "node:crypto";
import { createDbClient } from "../packages/db/src/client.js";
import { saoPauloTodayIso } from "../packages/db/src/seed-dev-support.js";
import { addCalendarMonths } from "../packages/domain/src/monthly-contract.js";
import { finance } from "../packages/api/src/finance/index.js";

const url = new URL(process.env.DATABASE_URL ?? "");
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.pathname !== "/lazuli_refactor_inicio"
)
  throw new Error("Este cenário pertence apenas ao banco local lazuli_refactor_inicio.");

const database = createDbClient();
const today = saoPauloTodayIso();
const date = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const days = (value: string, offset: number): string =>
  new Date(date(value).getTime() + offset * 86_400_000).toISOString().slice(0, 10);
const endingOn = days(today, 21);
const startingOn = addCalendarMonths(endingOn, -6);
const currentYear = Number(today.slice(0, 4));
const currentHalf = Number(today.slice(5, 7)) <= 6 ? 1 : 2;
const currentName = `${currentYear}.${currentHalf}`;
const previousName = currentHalf === 1 ? `${currentYear - 1}.2` : `${currentYear}.1`;

try {
  const existing = await database.student.findFirst({
    where: { fullName: "Fernanda Oliveira", deletedAt: null },
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
      const student = await tx.student.create({
        data: {
          fullName: "Fernanda Oliveira",
          birthDate: date(`${currentYear - 29}-09-14`),
          notes: "Prefere manter as aulas de terça e quinta no período da noite.",
        },
      });
      const priorEntry = date(days(previousSemester.startDate.toISOString().slice(0, 10), 10));
      const oldEnrollment = await tx.enrollment.create({
        data: {
          studentId: student.id,
          classId: previousClass.id,
          entryDate: priorEntry,
          exitDate: previousSemester.endDate,
          exitReason: "COMPLETED",
        },
      });
      const currentEnrollment = await tx.enrollment.create({
        data: {
          studentId: student.id,
          classId: currentClass.id,
          entryDate: currentSemester.startDate,
        },
      });
      for (const enrollment of [oldEnrollment, currentEnrollment]) {
        await tx.enrollmentAction.create({
          data: {
            enrollmentId: enrollment.id,
            kind: "ENTRY",
            status: "APPLIED",
            effectiveDate: enrollment.entryDate,
            recordedById: admin.id,
          },
        });
        await tx.pedagogicalProgress.create({
          data: {
            enrollmentId: enrollment.id,
            stageId: stage.id,
            startDate: enrollment.entryDate,
            ...(enrollment.exitDate
              ? { endDate: enrollment.exitDate, endReason: "TRANSFERRED" as const }
              : {}),
          },
        });
      }
      await tx.enrollmentAction.create({
        data: {
          enrollmentId: oldEnrollment.id,
          kind: "EXIT",
          status: "APPLIED",
          effectiveDate: previousSemester.endDate,
          recordedById: admin.id,
        },
      });
      const payer = await tx.payer.create({ data: { name: student.fullName } });
      const api = finance(tx, admin.id);
      const contract = await api.createMonthlyContract({
        commandId: randomUUID(),
        studentId: student.id,
        payerId: payer.id,
        agreedOn: days(startingOn, -9),
        startsOn: startingOn,
        durationMonths: 6,
        firstDueDate: startingOn,
        monthlyAmountCents: 100_000,
        scholarshipPct: 75,
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
        studentId: student.id,
        contractId: contract.id,
        paidInstallments: installments.length,
      };
    },
    { timeout: 90_000 },
  );
  console.log(JSON.stringify({ name: "Fernanda Oliveira", endingOn, ...result }, null, 2));
} finally {
  await database.$disconnect();
}
