/** Small, deliberate local dataset for reviewing the home and student pending queues. */
import { createDbClient, type TransactionClient } from "../packages/db/src/client.js";
import type { Guardian, Period, Stage, Student } from "../packages/db/src/index.js";
import type { Class } from "../packages/db/src/generated/prisma/client.js";
import { getDatabaseUrl } from "../packages/db/src/config.js";
import { seedCourseCatalog } from "../packages/db/src/seed-course-catalog.js";
import { saoPauloTodayIso } from "../packages/db/src/seed-dev-support.js";
import { finance } from "../packages/api/src/finance/index.js";

const url = new URL(getDatabaseUrl());
if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1")
  throw new Error("Este cenário só pode ser criado em PostgreSQL local.");
if (url.pathname !== "/lazuli_refactor_inicio")
  throw new Error("Este cenário pertence apenas ao banco lazuli_refactor_inicio.");

const database = createDbClient();
const today = saoPauloTodayIso();
const YEAR_END_INDEX = 4;
const MONTH_END_INDEX = 7;
const FIRST_HALF_END_MONTH = 6;
const ANA_CREATED_DAYS = -3;
const ISO_DAY_END = 10;
const MILLISECONDS_PER_DAY = 86_400_000;
const ANA_AGE = 15;
const RAFAEL_AGE = 22;
const LUISA_AGE = 17;
const DANIEL_AGE = 26;
const CAMILA_AGE = 24;
const PEDRO_AGE = 20;
const FIRST_DUE_DAYS = 14;
const VETERAN_EXIT_DAYS_BEFORE_END = -7;
const PREVIOUS_ENTRY_DAYS = 10;
const RECENT_ENTRY_DAYS = -2;
const RAFAEL_SCHOLARSHIP_PCT = 77;
const DANIEL_SCHOLARSHIP_PCT = 75;
const PAST_CONTRACT_AGREED_DAYS = 4;
const PAST_CONTRACT_START_DAYS = 10;
const year = Number(today.slice(0, YEAR_END_INDEX));
const half =
  Number(today.slice(YEAR_END_INDEX + 1, MONTH_END_INDEX)) <= FIRST_HALF_END_MONTH ? 1 : 2;
const currentStart = `${year}-${half === 1 ? "01-01" : "07-01"}`;
const currentEnd = `${year}-${half === 1 ? "06-30" : "12-31"}`;
const previousStart = half === 1 ? `${year - 1}-07-01` : `${year}-01-01`;
const previousEnd = half === 1 ? `${year - 1}-12-31` : `${year}-06-30`;
const nextStart = half === 1 ? `${year}-07-01` : `${year + 1}-01-01`;
const nextEnd = half === 1 ? `${year}-12-31` : `${year + 1}-06-30`;
const date = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const days = (value: string, offset: number): string =>
  new Date(date(value).getTime() + offset * MILLISECONDS_PER_DAY)
    .toISOString()
    .slice(0, ISO_DAY_END);
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
      const { stage, adultStage, current, previous, next } = await seedSchoolFoundation(
        tx,
        systemAdmin.id,
      );
      const { currentClass, previousClass } = await seedNightClasses(tx, {
        teacherId: teacher.id,
        adultStageId: adultStage.id,
        adminId: admin.id,
        current,
        previous,
      });

      const { anaGuardian, ana, rafael, luisa, daniel, camila } = await seedStudents(tx);
      const leadId = await seedLeads(tx, {
        ana,
        anaGuardian,
        adultStageId: adultStage.id,
        adminId: admin.id,
      });
      await seedFuturePlan(tx, {
        next,
        stageId: stage.id,
        trackId: stage.trackId,
        teacherId: teacher.id,
        adminId: admin.id,
        luisaId: luisa.id,
      });
      await seedCurrentEnrollment(tx, {
        danielId: daniel.id,
        currentClassId: currentClass.id,
        adminId: admin.id,
        adultStageId: adultStage.id,
      });
      await seedPreviousEnrollment(tx, {
        camilaId: camila.id,
        previousClassId: previousClass.id,
        adminId: admin.id,
        adultStageId: adultStage.id,
      });
      await seedContracts(tx, { rafael, daniel, camila, adminId: admin.id });
      return {
        ana: ana.id,
        rafael: rafael.id,
        luisa: luisa.id,
        daniel: daniel.id,
        camila: camila.id,
        lead: leadId,
      };
    },
    { timeout: 90_000 },
  );
  process.stdout.write(
    `${JSON.stringify({ database: url.pathname, today, students: result }, null, 2)}\n`,
  );
} finally {
  await database.$disconnect();
}

async function seedSchoolFoundation(
  tx: TransactionClient,
  systemAdminId: string,
): Promise<{ stage: Stage; adultStage: Stage; current: Period; previous: Period; next: Period }> {
  await seedCourseCatalog(tx);
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
      updatedById: systemAdminId,
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
  return { stage, adultStage, current, previous, next };
}

type NightClassesInput = {
  teacherId: string;
  adultStageId: string;
  adminId: string;
  current: Period;
  previous: Period;
};

async function createNightClass(
  tx: TransactionClient,
  input: { teacherId: string; stageId: string; semester: Period },
): Promise<Class> {
  const name = input.semester.name;
  return tx.class.create({
    data: {
      teacherId: input.teacherId,
      scheduleType: "REGULAR",
      format: "IN_PERSON",
      sharedStageId: input.stageId,
      year,
      capacity: 16,
      status: "ACTIVE",
      internalCode: `${name}-E1-NOITE`,
      portalClassName: `Essentials 1 · Noite · ${name}`,
      semesterId: input.semester.id,
      scheduleSlots: {
        create: ["TUESDAY", "THURSDAY"].map((weekday) => ({
          weekday: weekday as "TUESDAY" | "THURSDAY",
          startTime: new Date("1970-01-01T19:00:00Z"),
          endTime: new Date("1970-01-01T20:30:00Z"),
        })),
      },
    },
  });
}

async function seedNightClasses(
  tx: TransactionClient,
  input: NightClassesInput,
): Promise<{ currentClass: Class; previousClass: Class }> {
  const currentClass = await createNightClass(tx, {
    teacherId: input.teacherId,
    stageId: input.adultStageId,
    semester: input.current,
  });
  const previousClass = await createNightClass(tx, {
    teacherId: input.teacherId,
    stageId: input.adultStageId,
    semester: input.previous,
  });
  for (const [classroom, semester] of [
    [currentClass, input.current],
    [previousClass, input.previous],
  ] as const)
    await tx.classTeacherAssignment.create({
      data: {
        classId: classroom.id,
        teacherId: input.teacherId,
        effectiveDate: semester.startDate,
        recordedById: input.adminId,
      },
    });
  return { currentClass, previousClass };
}

type StudentSeed = {
  anaGuardian: Guardian;
  ana: Student;
  rafael: Student;
  luisa: Student;
  daniel: Student;
  camila: Student;
};
async function seedStudents(tx: TransactionClient): Promise<StudentSeed> {
  const anaGuardian = await tx.guardian.create({
    data: { fullName: "Patrícia Ferreira", relationship: "Mãe", phone: "11987654321" },
  });
  const luisaGuardian = await tx.guardian.create({
    data: { fullName: "Carla Nogueira", relationship: "Mãe", phone: "11987654322" },
  });
  const ana = await tx.student.create({
    data: {
      fullName: "Ana Clara Ferreira",
      birthDate: date(`${year - ANA_AGE}-04-17`),
      guardianId: anaGuardian.id,
      createdAt: new Date(`${days(today, ANA_CREATED_DAYS)}T14:00:00.000Z`),
    },
  });
  const rafael = await tx.student.create({
    data: {
      fullName: "Rafael Costa",
      birthDate: date(`${year - RAFAEL_AGE}-03-12`),
      createdAt: new Date(`${days(today, RECENT_ENTRY_DAYS)}T15:00:00.000Z`),
    },
  });
  const luisa = await tx.student.create({
    data: {
      fullName: "Luísa Nogueira",
      birthDate: date(`${year - LUISA_AGE}-05-22`),
      guardianId: luisaGuardian.id,
      createdAt: new Date(`${days(today, RECENT_ENTRY_DAYS)}T16:00:00.000Z`),
    },
  });
  const daniel = await tx.student.create({
    data: {
      fullName: "Daniel Martins",
      birthDate: date(`${year - DANIEL_AGE}-08-08`),
      notes: "Prefere aulas no período da noite. Confirmar material na próxima conversa.",
      createdAt: new Date(`${days(today, -1)}T13:00:00.000Z`),
    },
  });
  const camila = await tx.student.create({
    data: {
      fullName: "Camila Azevedo",
      birthDate: date(`${year - CAMILA_AGE}-02-06`),
      createdAt: new Date(`${days(today, -1)}T14:00:00.000Z`),
    },
  });
  return { anaGuardian, ana, rafael, luisa, daniel, camila };
}

async function seedLeads(
  tx: TransactionClient,
  input: {
    ana: StudentSeed["ana"];
    anaGuardian: StudentSeed["anaGuardian"];
    adultStageId: string;
    adminId: string;
  },
): Promise<string> {
  const lead = await tx.admissionCandidate.create({
    data: {
      fullName: input.ana.fullName,
      contactName: input.anaGuardian.fullName,
      contactRole: "GUARDIAN",
      contactOwner: "GUARDIAN",
      phone: input.anaGuardian.phone,
      birthDate: input.ana.birthDate,
      englishExperience: "SOME",
      status: "WAITING",
      scheduleType: "REGULAR",
      format: "IN_PERSON",
      studentId: input.ana.id,
      recordedById: input.adminId,
      source: "Indicação",
    },
  });
  await tx.admissionCandidate.create({
    data: {
      fullName: "Pedro Henrique Lima",
      phone: "11987654323",
      birthDate: date(`${year - PEDRO_AGE}-06-16`),
      englishExperience: "NONE",
      status: "WAITING",
      scheduleType: "REGULAR",
      format: "IN_PERSON",
      stageId: input.adultStageId,
      allocationPendingAt: new Date(`${days(today, -1)}T14:00:00.000Z`),
      allocationPendingReason: "Precisa de turma no período da manhã.",
      recordedById: input.adminId,
      source: "Site",
    },
  });
  return lead.id;
}

async function seedFuturePlan(
  tx: TransactionClient,
  input: {
    next: Period;
    stageId: string;
    trackId: string;
    teacherId: string;
    adminId: string;
    luisaId: string;
  },
): Promise<void> {
  const plan = await tx.semesterClassPlan.create({
    data: {
      semesterId: input.next.id,
      name: "Connect 1 · Terças e quintas",
      scheduleType: "REGULAR",
      format: "IN_PERSON",
      sharedStageId: input.stageId,
      teacherId: input.teacherId,
      slots: [
        { weekday: "TUESDAY", startTime: "16:00", endTime: "17:30" },
        { weekday: "THURSDAY", startTime: "16:00", endTime: "17:30" },
      ],
      recordedById: input.adminId,
    },
  });
  await tx.semesterPlacement.create({
    data: {
      semesterId: input.next.id,
      planId: plan.id,
      studentId: input.luisaId,
      trackId: input.trackId,
      stageId: input.stageId,
      mode: "ENTRY",
      effectiveDate: input.next.startDate,
      recordedById: input.adminId,
    },
  });
}

async function seedCurrentEnrollment(
  tx: TransactionClient,
  input: { danielId: string; currentClassId: string; adminId: string; adultStageId: string },
): Promise<void> {
  const currentEntry = date(days(today, -1));
  const danielEnrollment = await tx.enrollment.create({
    data: { studentId: input.danielId, classId: input.currentClassId, entryDate: currentEntry },
  });
  await tx.enrollmentAction.create({
    data: {
      enrollmentId: danielEnrollment.id,
      kind: "ENTRY",
      status: "APPLIED",
      effectiveDate: currentEntry,
      recordedById: input.adminId,
    },
  });
  await tx.pedagogicalProgress.create({
    data: {
      enrollmentId: danielEnrollment.id,
      stageId: input.adultStageId,
      startDate: currentEntry,
    },
  });
}

async function seedPreviousEnrollment(
  tx: TransactionClient,
  input: { camilaId: string; previousClassId: string; adminId: string; adultStageId: string },
): Promise<void> {
  const veteranExit = date(days(previousEnd, VETERAN_EXIT_DAYS_BEFORE_END));
  const camilaEnrollment = await tx.enrollment.create({
    data: {
      studentId: input.camilaId,
      classId: input.previousClassId,
      entryDate: date(days(previousStart, PREVIOUS_ENTRY_DAYS)),
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
      recordedById: input.adminId,
    },
  });
  await tx.enrollmentAction.create({
    data: {
      enrollmentId: camilaEnrollment.id,
      kind: "EXIT",
      status: "APPLIED",
      effectiveDate: veteranExit,
      recordedById: input.adminId,
    },
  });
  await tx.pedagogicalProgress.create({
    data: {
      enrollmentId: camilaEnrollment.id,
      stageId: input.adultStageId,
      startDate: camilaEnrollment.entryDate,
      endDate: veteranExit,
      endReason: "ADVANCED",
    },
  });
}

async function seedContracts(
  tx: TransactionClient,
  input: {
    rafael: StudentSeed["rafael"];
    daniel: StudentSeed["daniel"];
    camila: StudentSeed["camila"];
    adminId: string;
  },
): Promise<void> {
  const firstDue = days(today, FIRST_DUE_DAYS);
  const contractApi = finance(tx, input.adminId);
  for (const student of [input.rafael, input.daniel]) {
    const payer = await tx.payer.create({ data: { name: student.fullName } });
    await contractApi.createMonthlyContract({
      commandId: crypto.randomUUID(),
      studentId: student.id,
      payerId: payer.id,
      agreedOn: days(today, RECENT_ENTRY_DAYS),
      startsOn: firstDue,
      durationMonths: 12,
      firstDueDate: firstDue,
      monthlyAmountCents: 100_000,
      scholarshipPct:
        student.id === input.rafael.id ? RAFAEL_SCHOLARSHIP_PCT : DANIEL_SCHOLARSHIP_PCT,
      scholarshipAgreement: "Bolsa de continuidade acordada com a escola.",
    });
  }
  const camilaPayer = await tx.payer.create({ data: { name: input.camila.fullName } });
  await tx.contract.create({
    data: {
      studentId: input.camila.id,
      payerId: camilaPayer.id,
      agreedOn: date(days(previousStart, PAST_CONTRACT_AGREED_DAYS)),
      startsOn: date(days(previousStart, PAST_CONTRACT_START_DAYS)),
      endsOn: date(previousEnd),
      durationMonths: 6,
      monthlyAmountCents: 23_000,
    },
  });
}
