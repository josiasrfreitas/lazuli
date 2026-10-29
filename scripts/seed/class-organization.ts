import type { Semester } from "../../packages/db/src/index.js";
import type { DatabaseClient } from "../../packages/db/src/client.js";
import { DEV_ADMIN, DEV_TEACHERS } from "../../packages/db/src/seed-dev-data.js";
import { addDays, stableUuid, utcDate } from "../../packages/db/src/seed-dev-support.js";
import type { OrganizationContext } from "../../packages/api/src/semester-organization/data.js";
import { prepareSemester } from "../../packages/api/src/semester-organization/prepare.js";
import {
  saveContinuity,
  pendingLead,
} from "../../packages/api/src/semester-organization/lifecycle.js";
import { saveClassPlan } from "../../packages/api/src/semester-organization/write.js";
import { publishedOrganizationClass } from "./semester-organization-calendar.js";
import { organizationId, type OrganizationSlot } from "./semester-organization-data.js";

const ENTRY_DAYS_AGO = 21;
const STUDENT_AGE = 24;
const LEAD_AGE = 22;
const waitingPeople = [
  { name: "Alice Nunes Cavalcante", reason: "Só pode à noite; aguarda uma turma regular." },
  {
    name: "Bernardo Tavares Melo",
    reason: "Prefere turma regular ao PPT e pode começar neste período.",
  },
  { name: "Cecília Moura Leite", reason: "As turmas atuais coincidem com o horário de trabalho." },
  { name: "Daniela Porto Lins", reason: "Quer começar com outros alunos do mesmo estágio." },
  {
    name: "Eduardo Pires Calado",
    reason: "Disponível às terças e quintas à noite; sem turma compatível.",
  },
];
const eveningSlots: OrganizationSlot[] = ["TUESDAY", "THURSDAY"].map((weekday) => ({
  weekday: weekday as "TUESDAY" | "THURSDAY",
  startTime: "20:00",
  endTime: "21:00",
}));
type SeedContext = OrganizationContext & {
  semester: Semester;
  teacherId: string;
  today: Date;
  initialStageId: string;
  secondStageId: string;
};

/** Current operations join the complete seed; existing fixture identities stay intact. */
export async function seedClassOrganization(
  database: DatabaseClient,
  todayIso: string,
): Promise<void> {
  const context = await seedContext(database, todayIso);
  await database.$transaction(
    async (tx) => {
      const scoped = { ...context, database: tx };
      await seedSmallClass(scoped);
      await prepareSemester(scoped, context.semester.id);
      await seedContinuity(scoped);
      for (const [index, person] of waitingPeople.entries())
        await seedWaitingLead(scoped, { ...person, index });
      await seedUnknownStageLead(scoped);
      await seedDrafts(scoped);
    },
    { timeout: 60_000 },
  );
  process.stdout.write(
    "Current organization: 23 open classes, one draft, one closed plan, 2 transfers, 2 possible exits and 6 pending leads.\n",
  );
}

async function seedContext(database: DatabaseClient, todayIso: string): Promise<SeedContext> {
  const staffUser = await database.user.findUniqueOrThrow({
    where: { email: DEV_ADMIN.email },
    select: { id: true, name: true, email: true, role: true, isEnabled: true },
  });
  const today = utcDate(todayIso);
  const semester = await database.period.findFirstOrThrow({
    where: { startDate: { lte: today }, endDate: { gte: today }, deletedAt: null },
  });
  const teacher = await database.user.findUniqueOrThrow({
    where: { email: DEV_TEACHERS.find((item) => item.key === "camila")!.email },
  });
  const second = await database.stage.findFirstOrThrow({
    where: { internalCode: "E2", deletedAt: null },
  });
  const initial = await database.stage.findFirstOrThrow({
    where: { internalCode: "E1", deletedAt: null },
  });
  return {
    database,
    staffUser,
    semester,
    today,
    teacherId: teacher.id,
    initialStageId: initial.id,
    secondStageId: second.id,
    now: new Date(`${todayIso}T12:00:00-03:00`),
  };
}

async function seedSmallClass(context: SeedContext): Promise<void> {
  const { database, semester, teacherId, secondStageId, staffUser, today } = context;
  const entryDate = new Date(
    Math.max(semester.startDate.getTime(), addDays(today, -ENTRY_DAYS_AGO).getTime()),
  );
  const classroom = await publishedOrganizationClass({
    database,
    semester,
    teacherId,
    stageId: secondStageId,
    previousClassId: null,
    adminId: staffUser.id,
    publishedAt: entryDate,
    group: {
      key: "current-small-e2",
      name: "E2 · manhã",
      scheduleType: "REGULAR",
      format: "IN_PERSON",
      stageCode: "E2",
      teacherKey: "camila",
      slots: [{ weekday: "MONDAY", startTime: "10:00", endTime: "12:00" }],
      published: [],
      pending: [],
    },
  });
  for (const [index, name] of ["Marina Azevedo Peixoto", "Pedro Afonso Lacerda"].entries()) {
    await seedEnrolledStudent(context, { index, name, classId: classroom.id, entryDate });
  }
}

async function seedEnrolledStudent(
  context: SeedContext,
  input: { index: number; name: string; classId: string; entryDate: Date },
): Promise<void> {
  const { database, today, staffUser, secondStageId } = context;
  const { index, name: fullName, classId, entryDate } = input;
  const studentId = stableUuid(["organization-student", String(index)]);
  const enrollmentId = stableUuid(["organization-enrollment", String(index)]);
  await database.student.create({
    data: {
      id: studentId,
      fullName,
      birthDate: utcDate(`${today.getUTCFullYear() - STUDENT_AGE - index}-03-12`),
      email: `organizacao.aluno.${index + 1}@example.com`,
    },
  });
  await database.enrollment.create({ data: { id: enrollmentId, studentId, classId, entryDate } });
  await database.enrollmentAction.create({
    data: {
      id: stableUuid(["organization-entry", String(index)]),
      enrollmentId,
      kind: "ENTRY",
      status: "APPLIED",
      effectiveDate: entryDate,
      recordedById: staffUser.id,
      createdAt: entryDate,
    },
  });
  await database.pedagogicalProgress.create({
    data: {
      id: stableUuid(["organization-progress", String(index)]),
      enrollmentId,
      stageId: secondStageId,
      startDate: entryDate,
    },
  });
}

const continuityScenarios = [
  {
    classKey: "E1A",
    continuity: "CHANGE",
    reasons: [
      "Mudou o turno de trabalho. Precisa de uma turma às terças e quintas à noite.",
      "Quer continuar na escola em turma regular; o horário atual não funciona mais.",
    ],
  },
  {
    classKey: "E2A",
    continuity: "LEAVING",
    reasons: [
      "Pode se mudar de cidade no próximo período. Conversar antes de confirmar a saída.",
      "Está avaliando uma pausa por motivos financeiros. Retomar contato nesta semana.",
    ],
  },
] as const;

async function seedContinuity(context: SeedContext): Promise<void> {
  const { database, semester } = context;
  for (const { classKey, continuity, reasons } of continuityScenarios) {
    const placements = await database.semesterPlacement.findMany({
      where: {
        semesterId: semester.id,
        sourceEnrollment: { classId: stableUuid(["class", classKey]) },
      },
      orderBy: { studentId: "asc" },
      take: reasons.length,
    });
    if (placements.length !== reasons.length)
      throw new Error(`Missing continuity fixtures in ${classKey}`);
    for (const [index, reason] of reasons.entries()) {
      const row = placements.at(index)!;
      await saveContinuity(context, {
        semesterId: semester.id,
        id: row.id,
        version: row.version,
        continuity,
        reason,
      });
    }
  }
  // Existing annual contracts remain intact: coverage implies expected continuity,
  // without fabricating manual confirmation for the other students.
}

async function seedWaitingLead(
  context: SeedContext,
  person: { name: string; reason: string; index: number },
): Promise<void> {
  const { index } = person;
  const { database, today, semester, staffUser, now, initialStageId } = context;
  const id = stableUuid(["organization-lead", String(index)]);
  await database.admissionCandidate.create({
    data: {
      id,
      fullName: person.name,
      contactName: person.name,
      birthDate: utcDate(`${today.getUTCFullYear() - LEAD_AGE - index}-05-14`),
      email: `organizacao.lead.${index + 1}@example.com`,
      phone: `(82) 98411-12${String(index).padStart(2, "0")}`,
      englishExperience: "NONE",
      interest: "HIGH",
      source: "Indicação de aluno",
      scheduleType: "REGULAR",
      format: "IN_PERSON",
      stageId: initialStageId,

      recordedById: staffUser.id,
      notes:
        "Quer iniciar o curso de inglês. Estágio inicial definido em conversa com a coordenação.",
    },
  });
  await pendingLead(context, { id, pending: true, reason: person.reason });
}

async function seedUnknownStageLead(context: SeedContext): Promise<void> {
  const id = stableUuid(["organization-lead", "stage-pending"]);
  await context.database.admissionCandidate.create({
    data: {
      id,
      fullName: "Isabela Paes Mendonça",
      contactName: "Isabela Paes Mendonça",
      email: "organizacao.nivelamento@example.com",
      englishExperience: "SOME",
      notes: "Já estudou inglês; combinar prova de nivelamento antes de indicar estágio e turma.",
      recordedById: context.staffUser.id,
    },
  });
  await pendingLead(context, {
    id,
    pending: true,
    reason: "Aguarda nivelamento para definir o estágio.",
  });
}

async function seedDrafts(context: SeedContext): Promise<void> {
  const { database, semester, initialStageId, teacherId, staffUser, now } = context;
  await saveClassPlan(context, {
    semesterId: semester.id,
    version: 0,
    name: "E1 · nova turma da noite",
    scheduleType: "REGULAR",
    format: "IN_PERSON",
    teacherId,
    sharedStageId: initialStageId,
    slots: eveningSlots,
  });
  const stage = await database.stage.findFirstOrThrow({ where: { internalCode: "C2" } });
  await database.semesterClassPlan.create({
    data: {
      id: organizationId("plan", { semesterName: semester.name, key: "closed-current" }),
      semesterId: semester.id,
      name: "C2 · horário encerrado",
      scheduleType: "REGULAR",
      format: "IN_PERSON",
      sharedStageId: stage.id,
      slots: [{ weekday: "FRIDAY", startTime: "10:00", endTime: "12:00" }],
      closedAt: now,
      recordedById: staffUser.id,
    },
  });
}
