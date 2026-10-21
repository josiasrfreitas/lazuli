import type { DatabaseClient } from "../../packages/db/src/client.js";
import {
  DEV_ADMIN,
  DEV_CLASSES,
  DEV_STUDENTS,
  DEV_TEACHERS,
  type DevClassSeed,
  type DevStudentSeed,
  type DevWeekday,
} from "../../packages/db/src/seed-dev-data.js";
import { addDays, stableUuid, timeOfDay, utcDate } from "../../packages/db/src/seed-dev-support.js";

const PROSPECTS = [
  "Amanda Queiroz Barros",
  "Caio Vieira Dantas",
  "Bianca Freire Gusmão",
  "Enzo Melo Pimentel",
  "Lívia Torres Peixoto",
  "Gustavo Brito Leal",
  "Lara Pinheiro Viana",
  "Ruan Monteiro Paiva",
  "Vitória Chaves Neves",
  "Matheus Lisboa Reis",
  "Aline Pacheco Falcão",
  "Diego Amaral Sá",
] as const;
const QUICK_LEAD_KEYS = new Set(["prospect-3", "prospect-5", "prospect-9"]);
const PROSPECT_CONTACTS = new Map([
  ["prospect-3", "Mariana Freire Gusmão"],
  ["prospect-5", "Cláudia Torres Peixoto"],
  ["prospect-7", "Fernanda Pinheiro Viana"],
  ["prospect-9", "Ricardo Chaves Neves"],
]);
const LEAD_SOURCES = ["Instagram", "Indicação de aluno", "Site", "WhatsApp", "Visita à escola"];
const PROSPECT_PHONE_START = 1100;
const PERSONALIZED_CYCLE = 3;
const ARCHIVED_PROSPECT_START = 10;
const VISIT_OUTCOME_CYCLE = 4;
const AVAILABLE_DAYS = 45;
const CONFIRMATION_DAYS_AGO = 7;
const CREATION_DAYS_AGO = 14;
const EXPIRED_DAYS_AGO = 10;
const CONVERTED_CANDIDATES = 6;
const FRIDAY_JS_DAY = 5;
const DAYS_PER_WEEK = 7;
const INTRODUCTION_START_HOUR = 13;
const FUTURE_TRIAL_GROUP_SIZE = 6;
const REGULAR_CLASS_KEY = "E1B";
const CHILD_CLASS_KEY = "C1B";
const PERSONALIZED_CLASS_KEY = "PPT-E1";

type CandidateSeed = {
  key: string;
  fullName: string;
  contactName: string;
  phone: string | null;
  email: string | null;
  studentId: string | null;
};
type CandidateInput = {
  candidate: CandidateSeed;
  index: number;
  todayIso: string;
  adminId: string;
};
type CandidateRecordInput = CandidateInput & {
  id: string;
  classSeed: DevClassSeed;
  stageId: string | null;
  archived: boolean;
  unknownPedagogy: boolean;
};
type CommercialInput = CandidateInput & {
  createdOn: Date;
  status: "WAITING" | "ARCHIVED" | "ENROLLED";
};
type CommercialSeed = { contactName: string; source: string };
type PedagogySeed = {
  scheduleType: NonNullable<DevClassSeed["scheduleType"]> | null;
  format: "IN_PERSON" | null;
  stageId: string | null;
  availableUntil: Date | null;
  availabilityConfirmedAt: Date | null;
  availability: { create: ReturnType<typeof candidateAvailability> };
};
type VisitInput = { candidateId: string; index: number; todayIso: string; adminId: string };

/** Prospects are separate from the 250 students; waiting student records retain their identity. */
export async function seedAdmissions(database: DatabaseClient, todayIso: string): Promise<void> {
  const admin = await database.user.findUniqueOrThrow({ where: { email: DEV_ADMIN.email } });
  for (const [index, candidate] of candidateSeeds().entries()) {
    await seedCandidate(database, { candidate, index, todayIso, adminId: admin.id });
  }
  await seedConvertedCandidates(database, { adminId: admin.id, todayIso });
}

function candidateSeeds(): CandidateSeed[] {
  const waiting = DEV_STUDENTS.filter(
    (student) => student.status === "ACTIVE" && student.enrollments.length === 0,
  );
  return [
    ...PROSPECTS.map((fullName, index) => ({
      key: `prospect-${index + 1}`,
      fullName,
      contactName: PROSPECT_CONTACTS.get(`prospect-${index + 1}`) ?? fullName,
      phone: `(82) 98400-${String(PROSPECT_PHONE_START + index)}`,
      email: `interesse.${index + 1}@example.com`,
      studentId: null,
    })),
    ...waiting.map(studentCandidate),
  ];
}

function studentCandidate(student: DevStudentSeed): CandidateSeed {
  return {
    key: student.key,
    fullName: student.fullName,
    contactName: student.guardian?.fullName ?? student.fullName,
    phone: student.phone ?? null,
    email: student.email ?? null,
    studentId: stableUuid(["student", student.key]),
  };
}

async function seedCandidate(database: DatabaseClient, input: CandidateInput): Promise<void> {
  const { candidate, index, todayIso, adminId } = input;
  const personalized = index % PERSONALIZED_CYCLE === 0;
  const archived = !candidate.studentId && index >= ARCHIVED_PROSPECT_START;
  const classKey = candidateClassKey(input);
  const classSeed = DEV_CLASSES.find((row) => row.key === classKey)!;
  const unknownPedagogy = QUICK_LEAD_KEYS.has(candidate.key);
  const stage = unknownPedagogy
    ? null
    : await database.stage.findFirstOrThrow({
        where: { internalCode: classSeed.stageInternalCode },
      });
  const id = stableUuid(["admission", candidate.key]);
  await createCandidateRecord(database, {
    ...input,
    id,
    classSeed,
    stageId: stage?.id ?? null,
    archived,
    unknownPedagogy,
  });
  if (archived || unknownPedagogy) return;
  const visit = { candidateId: id, index, todayIso, adminId };
  if (personalized) await seedIntroduction(database, visit);
  else await seedTrial(database, { ...visit, classKey });
}

function candidateClassKey(input: CandidateInput): string {
  if (input.index % PERSONALIZED_CYCLE === 0) return PERSONALIZED_CLASS_KEY;
  return !input.candidate.studentId && input.index % 2 === 0 ? CHILD_CLASS_KEY : REGULAR_CLASS_KEY;
}

async function createCandidateRecord(
  database: DatabaseClient,
  input: CandidateRecordInput,
): Promise<void> {
  const { candidate, id, archived, todayIso } = input;
  const createdOn = addDays(utcDate(todayIso), archived ? -AVAILABLE_DAYS : -CREATION_DAYS_AGO);
  const status = archived ? "ARCHIVED" : "WAITING";
  await database.admissionCandidate.create({
    data: {
      id,
      fullName: candidate.fullName,
      phone: candidate.phone,
      email: candidate.email,
      studentId: candidate.studentId,
      status,
      recordedById: input.adminId,
      createdAt: createdOn,
      notes: archived
        ? "Contato encerrado a pedido da família; sem matrícula."
        : input.unknownPedagogy
          ? "Primeiro interesse registrado; curso e horários ainda serão definidos."
          : "Interesse confirmado; aguardando visita e definição de alocação.",
      ...candidatePedagogy(input),
      ...commercialFields({ ...input, createdOn, status }),
    },
  });
}

function candidatePedagogy(input: CandidateRecordInput): PedagogySeed {
  const { candidate, classSeed, archived, todayIso, unknownPedagogy } = input;
  return {
    scheduleType: unknownPedagogy ? null : (classSeed.scheduleType ?? "REGULAR"),
    format: unknownPedagogy ? null : "IN_PERSON",
    stageId: input.stageId,
    availableUntil: unknownPedagogy
      ? null
      : addDays(utcDate(todayIso), archived ? -EXPIRED_DAYS_AGO : AVAILABLE_DAYS),
    availabilityConfirmedAt: unknownPedagogy
      ? null
      : addDays(utcDate(todayIso), archived ? -AVAILABLE_DAYS : -CONFIRMATION_DAYS_AGO),
    availability: { create: unknownPedagogy ? [] : candidateAvailability(candidate, classSeed) },
  };
}

function commercialFields(input: CommercialInput): CommercialSeed {
  return {
    contactName: input.candidate.contactName,
    source: LEAD_SOURCES[input.index % LEAD_SOURCES.length]!,
  };
}

function candidateAvailability(
  candidate: CandidateSeed,
  classSeed: DevClassSeed,
): Array<{
  id: string;
  weekday: DevWeekday;
  startTime: Date;
  endTime: Date;
}> {
  return classSeed.slots.map((slot) => ({
    id: stableUuid(["admission-slot", candidate.key, slot.weekday, slot.startTime]),
    weekday: slot.weekday,
    startTime: timeOfDay(slot.startTime),
    endTime: timeOfDay(slot.endTime),
  }));
}

async function seedTrial(
  database: DatabaseClient,
  input: VisitInput & { classKey: string },
): Promise<void> {
  const past = input.index % VISIT_OUTCOME_CYCLE === 1;
  const earliest = addDays(
    utcDate(input.todayIso),
    Math.floor(input.index / FUTURE_TRIAL_GROUP_SIZE) * DAYS_PER_WEEK,
  );
  const session = await database.classSession.findFirst({
    where: {
      classId: stableUuid(["class", input.classKey]),
      status: "SCHEDULED",
      date: past ? { lt: utcDate(input.todayIso) } : { gt: earliest },
    },
    include: { class: { select: { teacherId: true } } },
    orderBy: { date: past ? "desc" : "asc" },
  });
  if (!session) return;
  await database.entryVisit.create({
    data: {
      id: stableUuid(["entry-visit", input.candidateId]),
      candidateId: input.candidateId,
      kind: "TRIAL",
      status: past ? "ATTENDED" : "SCHEDULED",
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      format: "IN_PERSON",
      classId: session.classId,
      teacherId: session.class.teacherId,
      classSessionId: session.id,
      scheduleSlotId: session.scheduleSlotId,
      recordedById: input.adminId,
      notes: past
        ? "Participou da experimental; família avaliando os horários."
        : "Família confirmou participação na experimental.",
    },
  });
}

async function seedIntroduction(database: DatabaseClient, input: VisitInput): Promise<void> {
  const teacherSeed = DEV_TEACHERS[input.index % DEV_TEACHERS.length]!;
  const teacher = await database.user.findUniqueOrThrow({ where: { email: teacherSeed.email } });
  const date = await nextOpenFriday(database, input.todayIso);
  const hour = INTRODUCTION_START_HOUR + Math.floor(input.index / DEV_TEACHERS.length);
  await database.entryVisit.create({
    data: {
      id: stableUuid(["entry-visit", input.candidateId]),
      candidateId: input.candidateId,
      kind: "INTRODUCTION",
      status: "SCHEDULED",
      date,
      startTime: timeOfDay(`${hour}:00`),
      endTime: timeOfDay(`${hour}:45`),
      format: "IN_PERSON",
      teacherId: teacher.id,
      recordedById: input.adminId,
      notes: "Apresentação do curso personalizado e do material; horário reservado com o docente.",
    },
  });
  await database.admissionAvailability.create({
    data: {
      id: stableUuid(["admission-introduction-slot", input.candidateId]),
      candidateId: input.candidateId,
      weekday: "FRIDAY",
      startTime: timeOfDay("13:00"),
      endTime: timeOfDay("17:00"),
    },
  });
}

async function nextOpenFriday(database: DatabaseClient, todayIso: string): Promise<Date> {
  const today = utcDate(todayIso);
  const daysToFriday =
    (FRIDAY_JS_DAY - today.getUTCDay() + DAYS_PER_WEEK) % DAYS_PER_WEEK || DAYS_PER_WEEK;
  let date = addDays(today, daysToFriday);
  while (await database.schoolClosedDay.findUnique({ where: { date } }))
    date = addDays(date, DAYS_PER_WEEK);
  return date;
}

async function seedConvertedCandidates(
  database: DatabaseClient,
  input: { adminId: string; todayIso: string },
): Promise<void> {
  const students = DEV_STUDENTS.filter(
    (row) => (row.enrollments[0]?.entryOffsetDays ?? 0) > 0,
  ).slice(0, CONVERTED_CANDIDATES);
  for (const [index, student] of students.entries())
    await createConvertedCandidate(database, { ...input, student, index });
}

async function createConvertedCandidate(
  database: DatabaseClient,
  input: {
    student: DevStudentSeed;
    adminId: string;
    todayIso: string;
    index: number;
  },
): Promise<void> {
  const { student, adminId } = input;
  const enrollment = await database.enrollment.findUniqueOrThrow({
    where: { id: stableUuid(["enrollment", student.key, student.enrollments[0]!.classKey]) },
  });
  const classroom = await database.class.findUniqueOrThrow({ where: { id: enrollment.classId } });
  await database.admissionCandidate.create({
    data: {
      id: stableUuid(["admission", student.key]),
      fullName: student.fullName,
      phone: student.phone ?? null,
      email: student.email ?? null,
      status: "ENROLLED",
      scheduleType: classroom.scheduleType,
      format: classroom.format,
      stageId: classroom.sharedStageId,
      studentId: enrollment.studentId,
      enrollmentId: enrollment.id,
      availableUntil: addDays(enrollment.entryDate, AVAILABLE_DAYS),
      availabilityConfirmedAt: addDays(enrollment.entryDate, -CONFIRMATION_DAYS_AGO),
      createdAt: addDays(enrollment.entryDate, -CREATION_DAYS_AGO),
      recordedById: adminId,
      notes: "Horário acordado e entrada concluída pela secretaria.",
      ...commercialFields({
        ...input,
        candidate: studentCandidate(student),
        createdOn: addDays(enrollment.entryDate, -CREATION_DAYS_AGO),
        status: "ENROLLED",
      }),
    },
  });
}
