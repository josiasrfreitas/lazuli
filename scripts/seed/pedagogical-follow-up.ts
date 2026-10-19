import type { DatabaseClient, TransactionClient } from "../../packages/db/src/client.js";
import { DEV_ADMIN, DEV_STUDENTS } from "../../packages/db/src/seed-dev-data.js";
import {
  addDays,
  endOfDayUtc,
  isoOf,
  stableUuid,
  utcDate,
} from "../../packages/db/src/seed-dev-support.js";
import { ACTIVITY_ACTIONS, type ActivityAction } from "../../packages/api/src/activity/catalog.js";
import {
  OCCURRENCE_EXAMPLES,
  PEDAGOGICAL_FOLLOW_UP_SCENARIOS,
  type FollowUpScenario,
} from "./pedagogical-follow-up-data.js";

const ADMIN_UTC_HOUR = 18;
const OBSERVATION_INTERVAL_DAYS = 7;

const SUBJECT_INCLUDE = {
  student: true,
  class: { include: { teacher: { include: { teacherProfile: true } } } },
} as const;
const SESSION_SELECT = {
  classSession: {
    select: { id: true, date: true, usualTeacher: { select: { id: true, name: true } } },
  },
} as const;

type Staff = { id: string; name: string };
type Teacher = Staff & {
  deletedAt: Date | null;
  teacherProfile: { deletedAt: Date | null; departureDate: Date | null } | null;
};
type Session = { id: string; date: Date; usualTeacher: Staff | null };
type Subject = {
  id: string;
  key: string;
  fullName: string;
  teacher: Staff;
  presentSessions: Session[];
};
type OccurrenceSeed = {
  id: string;
  studentId: string;
  classSessionId: string;
  category: FollowUpScenario["category"];
  title: string;
  account: string;
  initialResponse: string | null;
  recordedById: string;
  createdAt: Date;
};
type FollowUpSeed = {
  id: string;
  body: string;
  createdAt: Date;
  recordedById: string;
};
type ScenarioContext = {
  scenario: FollowUpScenario;
  subject: Subject;
  admin: Staff;
  todayIso: string;
  occurrences: OccurrenceSeed[];
  followUps: FollowUpSeed[];
  interventionId: string;
};
export type PedagogicalFollowUpSeedResult = {
  occurrences: number;
  interventions: number;
  skippedScenarios: number;
};

/** May add only missing V10 scenarios to this workspace; never resets or overwrites existing data. */
export async function seedPedagogicalFollowUp(
  database: DatabaseClient,
  todayIso: string,
): Promise<PedagogicalFollowUpSeedResult> {
  const admin = await database.user.findUniqueOrThrow({
    where: { email: DEV_ADMIN.email },
    select: { id: true, name: true },
  });
  const result = { occurrences: 0, interventions: 0, skippedScenarios: 0 };
  for (const scenario of PEDAGOGICAL_FOLLOW_UP_SCENARIOS) {
    const context = await scenarioContext(database, { scenario, admin, todayIso });
    if (!context) {
      result.skippedScenarios += 1;
      continue;
    }
    const created = await database.$transaction((transaction) =>
      createScenario(transaction, context),
    );
    if (!created) {
      result.skippedScenarios += 1;
      continue;
    }
    result.occurrences += context.occurrences.length;
    result.interventions += scenario.intervention ? 1 : 0;
  }
  return result;
}

async function scenarioContext(
  database: DatabaseClient,
  input: { scenario: FollowUpScenario; admin: Staff; todayIso: string },
): Promise<ScenarioContext | null> {
  const subject = await scenarioSubject(database, input);
  if (!subject) return null;
  const sessions = input.scenario.daysAgo.map((days) =>
    subject.presentSessions
      .filter((session) => session.date <= addDays(utcDate(input.todayIso), -days))
      .at(-1),
  );
  if (sessions.some((session) => !session?.usualTeacher)) return null;
  const available = sessions.filter((session): session is Session => session !== undefined);
  if (new Set(available.map((session) => session.id)).size !== input.scenario.daysAgo.length)
    return null;
  const occurrences = available.map((session, index) =>
    occurrenceSeed({ ...input, subject, session, index }),
  );
  const context = {
    ...input,
    subject,
    occurrences,
    followUps: [],
    interventionId: stableUuid(["dev-intervention", subject.key, input.scenario.key]),
  };
  const followUps = interventionFollowUps(context);
  return followUps === null ? null : { ...context, followUps };
}

async function scenarioSubject(
  database: DatabaseClient,
  input: { scenario: FollowUpScenario; todayIso: string },
): Promise<Subject | null> {
  const student = DEV_STUDENTS[input.scenario.studentIndex]!;
  const placement = student.enrollments[0]!;
  const enrollment = await database.enrollment.findUnique({
    where: { id: stableUuid(["enrollment", student.key, placement.classKey]) },
    include: SUBJECT_INCLUDE,
  });
  if (
    !enrollment ||
    enrollment.deletedAt ||
    enrollment.student.deletedAt ||
    enrollment.class.deletedAt
  )
    return null;
  const teacher = enrollment.class.teacher;
  if (!teacher || !eligibleTeacher(teacher, input.todayIso)) return null;
  const before =
    enrollment.exitDate && enrollment.exitDate < utcDate(input.todayIso)
      ? enrollment.exitDate
      : utcDate(input.todayIso);
  const sessions = await presentSessions(database, {
    enrollmentId: enrollment.id,
    entryDate: enrollment.entryDate,
    before,
  });
  return {
    id: enrollment.studentId,
    key: student.key,
    fullName: enrollment.student.fullName,
    teacher: { id: teacher.id, name: teacher.name },
    presentSessions: sessions,
  };
}

function eligibleTeacher(teacher: Teacher, todayIso: string): boolean {
  const profile = teacher.teacherProfile;
  if (teacher.deletedAt || !profile || profile.deletedAt) return false;
  return profile.departureDate === null || profile.departureDate > utcDate(todayIso);
}

async function presentSessions(
  database: DatabaseClient,
  input: { enrollmentId: string; entryDate: Date; before: Date },
): Promise<Session[]> {
  const attendance = await database.attendance.findMany({
    where: {
      enrollmentId: input.enrollmentId,
      deletedAt: null,
      status: "PRESENT",
      classSession: {
        deletedAt: null,
        status: "SCHEDULED",
        attendanceConfirmedAt: { not: null },
        date: { gte: input.entryDate, lt: input.before },
      },
    },
    select: SESSION_SELECT,
    orderBy: { classSession: { date: "asc" } },
  });
  return attendance.map((row) => row.classSession);
}

function occurrenceSeed(input: {
  scenario: FollowUpScenario;
  subject: Subject;
  session: Session;
  index: number;
}): OccurrenceSeed {
  const { scenario, subject, session, index } = input;
  const example = OCCURRENCE_EXAMPLES[scenario.category];
  return {
    id: stableUuid(["dev-occurrence", subject.key, scenario.key, String(index)]),
    studentId: subject.id,
    classSessionId: session.id,
    category: scenario.category,
    title: example.title,
    account:
      index === 0
        ? example.account
        : `${example.account} O registro retoma a observação anterior para acompanhar o apoio oferecido.`,
    initialResponse:
      scenario.studentIndex % 3 === 0 && index === 0 ? null : example.initialResponse,
    recordedById: session.usualTeacher!.id,
    createdAt: endOfDayUtc(isoOf(session.date)),
  };
}

function interventionFollowUps(context: ScenarioContext): FollowUpSeed[] | null {
  const intervention = context.scenario.intervention;
  if (!intervention) return [];
  const performedOn = addDays(utcDate(schoolDate(context.occurrences.at(-1)!.createdAt)), 1);
  if (isoOf(performedOn) > context.todayIso) return null;
  const session = context.subject.presentSessions.find(
    (row) => row.date >= addDays(performedOn, OBSERVATION_INTERVAL_DAYS),
  );
  if (!session) return [];
  const createdAt = endOfDayUtc(isoOf(session.date));
  return [
    {
      // Retain the identity of the existing first narrative follow-up.
      id: stableUuid(["dev-follow-up", context.interventionId, "NOTE", createdAt.toISOString()]),
      body: intervention.evolution,
      createdAt,
      recordedById: context.subject.teacher.id,
    },
  ];
}

async function createScenario(
  transaction: TransactionClient,
  context: ScenarioContext,
): Promise<boolean> {
  const prior = await transaction.pedagogicalOccurrence.findFirst({
    // Explicit visibility also finds soft-deleted seed roots, which must stay untouched.
    where: { id: { in: context.occurrences.map((row) => row.id) }, deletedAt: {} },
    select: { id: true },
  });
  if (prior) return false;
  const intervention = await transaction.pedagogicalIntervention.findUnique({
    where: { id: context.interventionId, deletedAt: {} },
    select: { id: true },
  });
  if (intervention) return false;
  await transaction.pedagogicalOccurrence.createMany({ data: context.occurrences });
  for (const row of context.occurrences)
    await activityEvent(transaction, {
      context,
      action: "occurrences.create",
      key: row.id,
      occurredAt: row.createdAt,
      actor: occurrenceAuthor(context, row.recordedById),
      description: row.title,
    });
  if (context.scenario.related) await relatedOccurrences(transaction, context);
  else if (context.scenario.intervention) await createIntervention(transaction, context);

  return true;
}

function occurrenceAuthor(context: ScenarioContext, id: string): Staff {
  return context.subject.presentSessions.find((row) => row.usualTeacher?.id === id)!.usualTeacher!;
}

async function relatedOccurrences(
  transaction: TransactionClient,
  context: ScenarioContext,
): Promise<void> {
  const [fromId, toId] = context.occurrences.map((row) => row.id).sort();
  const createdAt = context.occurrences.at(-1)!.createdAt;
  const id = stableUuid(["dev-occurrence-relation", fromId!, toId!]);
  await transaction.occurrenceRelation.create({
    data: { id, fromId: fromId!, toId: toId!, createdAt, recordedById: context.admin.id },
  });
  await activityEvent(transaction, {
    context,
    action: "occurrences.link",
    key: id,
    occurredAt: createdAt,
    actor: context.admin,
    description:
      "Relacionadas duas observações do mesmo aluno; acompanhamento mantido na rotina da aula.",
  });
}

async function createIntervention(
  transaction: TransactionClient,
  context: ScenarioContext,
): Promise<void> {
  const intervention = context.scenario.intervention!;
  const performedOn = addDays(utcDate(schoolDate(context.occurrences.at(-1)!.createdAt)), 1);
  const createdAt = adminTimestamp(performedOn);
  await transaction.pedagogicalIntervention.create({
    data: {
      id: context.interventionId,
      studentId: context.subject.id,
      responsibleId: context.subject.teacher.id,
      recordedById: context.admin.id,
      title: intervention.title,
      treatment: intervention.treatment,
      performedOn,
      createdAt,
      version: context.followUps.length,
      occurrences: {
        create: context.occurrences.map((row) => ({
          id: stableUuid(["dev-intervention-occurrence", context.interventionId, row.id]),
          occurrenceId: row.id,
          createdAt,
        })),
      },
      followUps: { create: context.followUps },
    },
  });
  await activityEvent(transaction, {
    context,
    action: "interventions.create",
    key: context.interventionId,
    occurredAt: createdAt,
    actor: context.admin,
    description: intervention.title,
  });
  await activityEvent(transaction, {
    context,
    action: "interventions.link",
    key: context.interventionId,
    occurredAt: createdAt,
    actor: context.admin,
    description: "Três ocorrências motivadoras vinculadas ao acompanhamento.",
  });
  for (const row of context.followUps)
    await activityEvent(transaction, {
      context,
      action: "interventions.followUp",
      key: row.id,
      occurredAt: row.createdAt,
      actor: context.subject.teacher,
      description: row.body,
    });
}

async function activityEvent(
  transaction: TransactionClient,
  input: {
    context: ScenarioContext;
    action: ActivityAction;
    key: string;
    occurredAt: Date;
    actor: Staff;
    description: string;
  },
): Promise<void> {
  const [area, title] = ACTIVITY_ACTIONS[input.action];
  await transaction.activityEvent.create({
    data: {
      id: stableUuid(["dev-v10-activity", input.action, input.key]),
      deduplicationKey: `dev-v10:${input.action}:${input.key}`,
      occurredAt: input.occurredAt,
      actorId: input.actor.id,
      actorName: input.actor.name,
      action: input.action,
      area,
      title,
      subjectType: "student",
      subjectId: input.context.subject.id,
      subjectName: input.context.subject.fullName,
      description: input.description,
    },
  });
}

function adminTimestamp(date: Date): Date {
  const timestamp = new Date(date);
  timestamp.setUTCHours(ADMIN_UTC_HOUR, 0, 0, 0);
  return timestamp;
}

function schoolDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}
