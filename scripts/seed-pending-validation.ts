/** Small, deliberate local dataset for reviewing the home and student pending queues. */
import { createDbClient } from "../packages/db/src/client.js";
import { seedCourseCatalog } from "../packages/db/src/seed-course-catalog.js";
import { saoPauloTodayIso } from "../packages/db/src/seed-dev-support.js";
import { finance } from "../packages/api/src/finance/index.js";

const url = new URL(process.env.DATABASE_URL ?? "");
if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1")
  throw new Error("Este cenário só pode ser criado em PostgreSQL local.");
if (url.pathname !== "/lazuli_refactor_inicio")
  throw new Error("Este cenário pertence apenas ao banco lazuli_refactor_inicio.");

const database = createDbClient();
const today = saoPauloTodayIso();
const year = Number(today.slice(0, 4));
const half = Number(today.slice(5, 7)) <= 6 ? 1 : 2;
const currentStart = `${year}-${half === 1 ? "01-01" : "07-01"}`;
const currentEnd = `${year}-${half === 1 ? "06-30" : "12-31"}`;
const previousStart = half === 1 ? `${year - 1}-07-01` : `${year}-01-01`;
const previousEnd = half === 1 ? `${year - 1}-12-31` : `${year}-06-30`;
const nextStart = half === 1 ? `${year}-07-01` : `${year + 1}-01-01`;
const nextEnd = half === 1 ? `${year}-12-31` : `${year + 1}-06-30`;
const date = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const days = (value: string, offset: number): string =>
  new Date(date(value).getTime() + offset * 86_400_000).toISOString().slice(0, 10);
const currentName = `${year}.${half}`;
const previousName = half === 1 ? `${year - 1}.2` : `${year}.1`;
const nextName = half === 1 ? `${year}.2` : `${year + 1}.1`;

try {
  const [semesters, classes, leads, existingScenarios] = await Promise.all([
    database.period.count(),
    database.class.count(),
    database.admissionCandidate.count(),
    database.student.count({
      where: {
        fullName: {
          in: [
            "Ana Clara Ferreira",
            "Rafael Costa",
            "Luísa Nogueira",
            "Daniel Martins",
            "Camila Azevedo",
          ],
        },
      },
    }),
  ]);
  if (semesters || classes || leads || existingScenarios)
    throw new Error("O cenário escolar já existe ou o banco mudou. Nenhum registro foi alterado.");
  const admin = await database.user.findFirstOrThrow({
    where: { email: "dev@lazuli.local", role: "ADMIN", deletedAt: null },
  });
  const teacher = await database.user.findFirstOrThrow({
    where: { email: "juliana.prado@lazuli.local", role: "TEACHER", deletedAt: null },
  });
  const systemAdmin = await database.user.findFirstOrThrow({
    where: { email: "sistema@lazuli.local", role: "SYSTEM_ADMIN", deletedAt: null },
  });

  const result = await database.$transaction(
    async (tx) => {
      await seedCourseCatalog(tx as Parameters<typeof seedCourseCatalog>[0]);
      const stage = await tx.stage.findFirstOrThrow({ where: { internalCode: "C1" } });
      const adultStage = await tx.stage.findFirstOrThrow({ where: { internalCode: "E1" } });
      await tx.financeSettings.upsert({
        where: { id: "singleton" },
        update: {},
        create: {
          id: "singleton",
          tuitionCeilingCents: 25_000,
          maximumDiscountPct: "20",
          punctualityDiscountPct: "10",
          interestRatePctMonthly: "2",
          cancellationFeePct: "10",
          materialPriceCents: 12_000,
          updatedById: systemAdmin.id,
        },
      });
      const current = await tx.period.create({
        data: { name: currentName, startDate: date(currentStart), endDate: date(currentEnd) },
      });
      const previous = await tx.period.create({
        data: { name: previousName, startDate: date(previousStart), endDate: date(previousEnd) },
      });
      const next = await tx.period.create({
        data: { name: nextName, startDate: date(nextStart), endDate: date(nextEnd) },
      });
      const slots = [
        { weekday: "TUESDAY" as const, startTime: "19:00", endTime: "20:30" },
        { weekday: "THURSDAY" as const, startTime: "19:00", endTime: "20:30" },
      ];
      const classData = {
        teacherId: teacher.id,
        scheduleType: "REGULAR" as const,
        format: "IN_PERSON" as const,
        sharedStageId: adultStage.id,
        year,
        capacity: 16,
        status: "ACTIVE" as const,
      };
      const currentClass = await tx.class.create({
        data: {
          ...classData,
          internalCode: `${currentName}-E1-NOITE`,
          portalClassName: `Essentials 1 · Noite · ${currentName}`,
          semesterId: current.id,
          scheduleSlots: {
            create: slots.map((slot) => ({
              weekday: slot.weekday,
              startTime: new Date(`1970-01-01T${slot.startTime}:00Z`),
              endTime: new Date(`1970-01-01T${slot.endTime}:00Z`),
            })),
          },
        },
      });
      const previousClass = await tx.class.create({
        data: {
          ...classData,
          internalCode: `${previousName}-E1-NOITE`,
          portalClassName: `Essentials 1 · Noite · ${previousName}`,
          semesterId: previous.id,
          scheduleSlots: {
            create: slots.map((slot) => ({
              weekday: slot.weekday,
              startTime: new Date(`1970-01-01T${slot.startTime}:00Z`),
              endTime: new Date(`1970-01-01T${slot.endTime}:00Z`),
            })),
          },
        },
      });
      for (const classroom of [currentClass, previousClass])
        await tx.classTeacherAssignment.create({
          data: {
            classId: classroom.id,
            teacherId: teacher.id,
            effectiveDate:
              classroom.id === currentClass.id ? current.startDate : previous.startDate,
            recordedById: admin.id,
          },
        });

      const anaGuardian = await tx.guardian.create({
        data: { fullName: "Patrícia Ferreira", relationship: "Mãe", phone: "11987654321" },
      });
      const luisaGuardian = await tx.guardian.create({
        data: { fullName: "Carla Nogueira", relationship: "Mãe", phone: "11987654322" },
      });
      const ana = await tx.student.create({
        data: {
          fullName: "Ana Clara Ferreira",
          birthDate: date(`${year - 15}-04-17`),
          guardianId: anaGuardian.id,
          createdAt: new Date(`${days(today, -3)}T14:00:00.000Z`),
        },
      });
      const rafael = await tx.student.create({
        data: {
          fullName: "Rafael Costa",
          birthDate: date(`${year - 22}-03-12`),
          createdAt: new Date(`${days(today, -2)}T15:00:00.000Z`),
        },
      });
      const luisa = await tx.student.create({
        data: {
          fullName: "Luísa Nogueira",
          birthDate: date(`${year - 17}-05-22`),
          guardianId: luisaGuardian.id,
          createdAt: new Date(`${days(today, -2)}T16:00:00.000Z`),
        },
      });
      const daniel = await tx.student.create({
        data: {
          fullName: "Daniel Martins",
          birthDate: date(`${year - 26}-08-08`),
          notes: "Prefere aulas no período da noite. Confirmar material na próxima conversa.",
          createdAt: new Date(`${days(today, -1)}T13:00:00.000Z`),
        },
      });
      const camila = await tx.student.create({
        data: {
          fullName: "Camila Azevedo",
          birthDate: date(`${year - 24}-02-06`),
          createdAt: new Date(`${days(today, -1)}T14:00:00.000Z`),
        },
      });
      const lead = await tx.admissionCandidate.create({
        data: {
          fullName: ana.fullName,
          contactName: anaGuardian.fullName,
          contactRole: "GUARDIAN",
          contactOwner: "GUARDIAN",
          phone: anaGuardian.phone,
          birthDate: ana.birthDate,
          englishExperience: "SOME",
          status: "WAITING",
          scheduleType: "REGULAR",
          format: "IN_PERSON",
          studentId: ana.id,
          recordedById: admin.id,
          source: "Indicação",
        },
      });
      await tx.admissionCandidate.create({
        data: {
          fullName: "Pedro Henrique Lima",
          phone: "11987654323",
          birthDate: date(`${year - 20}-06-16`),
          englishExperience: "NONE",
          status: "WAITING",
          scheduleType: "REGULAR",
          format: "IN_PERSON",
          stageId: adultStage.id,
          allocationPendingAt: new Date(`${days(today, -1)}T14:00:00.000Z`),
          allocationPendingReason: "Precisa de turma no período da manhã.",
          recordedById: admin.id,
          source: "Site",
        },
      });

      const plan = await tx.semesterClassPlan.create({
        data: {
          semesterId: next.id,
          name: "Connect 1 · Terças e quintas",
          scheduleType: "REGULAR",
          format: "IN_PERSON",
          sharedStageId: stage.id,
          teacherId: teacher.id,
          slots: [
            { weekday: "TUESDAY", startTime: "16:00", endTime: "17:30" },
            { weekday: "THURSDAY", startTime: "16:00", endTime: "17:30" },
          ],
          recordedById: admin.id,
        },
      });
      await tx.semesterPlacement.create({
        data: {
          semesterId: next.id,
          planId: plan.id,
          studentId: luisa.id,
          trackId: stage.trackId,
          stageId: stage.id,
          mode: "ENTRY",
          effectiveDate: next.startDate,
          recordedById: admin.id,
        },
      });

      const currentEntry = date(days(today, -1));
      const danielEnrollment = await tx.enrollment.create({
        data: { studentId: daniel.id, classId: currentClass.id, entryDate: currentEntry },
      });
      await tx.enrollmentAction.create({
        data: {
          enrollmentId: danielEnrollment.id,
          kind: "ENTRY",
          status: "APPLIED",
          effectiveDate: currentEntry,
          recordedById: admin.id,
        },
      });
      await tx.pedagogicalProgress.create({
        data: {
          enrollmentId: danielEnrollment.id,
          stageId: adultStage.id,
          startDate: currentEntry,
        },
      });
      const veteranExit = date(days(previousEnd, -7));
      const camilaEnrollment = await tx.enrollment.create({
        data: {
          studentId: camila.id,
          classId: previousClass.id,
          entryDate: date(days(previousStart, 10)),
          exitDate: veteranExit,
          exitReason: "COMPLETED",
        },
      });
      await tx.enrollmentAction.create({
        data: {
          enrollmentId: camilaEnrollment.id,
          kind: "ENTRY",
          status: "APPLIED",
          effectiveDate: camilaEnrollment.entryDate,
          recordedById: admin.id,
        },
      });
      await tx.enrollmentAction.create({
        data: {
          enrollmentId: camilaEnrollment.id,
          kind: "EXIT",
          status: "APPLIED",
          effectiveDate: veteranExit,
          recordedById: admin.id,
        },
      });
      await tx.pedagogicalProgress.create({
        data: {
          enrollmentId: camilaEnrollment.id,
          stageId: adultStage.id,
          startDate: camilaEnrollment.entryDate,
          endDate: veteranExit,
          endReason: "ADVANCED",
        },
      });

      const firstDue = days(today, 14);
      const contractApi = finance(tx, admin.id);
      for (const student of [rafael, daniel]) {
        const payer = await tx.payer.create({ data: { name: student.fullName } });
        await contractApi.createMonthlyContract({
          commandId: crypto.randomUUID(),
          studentId: student.id,
          payerId: payer.id,
          agreedOn: days(today, -2),
          startsOn: firstDue,
          durationMonths: 12,
          firstDueDate: firstDue,
          monthlyAmountCents: 100_000,
          scholarshipPct: student.id === rafael.id ? 77 : 75,
          scholarshipAgreement: "Bolsa de continuidade acordada com a escola.",
        });
      }
      const camilaPayer = await tx.payer.create({ data: { name: camila.fullName } });
      await tx.contract.create({
        data: {
          studentId: camila.id,
          payerId: camilaPayer.id,
          agreedOn: date(days(previousStart, 4)),
          startsOn: date(days(previousStart, 10)),
          endsOn: date(previousEnd),
          durationMonths: 6,
          monthlyAmountCents: 23_000,
        },
      });

      return {
        ana: ana.id,
        rafael: rafael.id,
        luisa: luisa.id,
        daniel: daniel.id,
        camila: camila.id,
        lead: lead.id,
      };
    },
    { timeout: 90_000 },
  );
  console.log(JSON.stringify({ database: url.pathname, today, students: result }, null, 2));
} finally {
  await database.$disconnect();
}
