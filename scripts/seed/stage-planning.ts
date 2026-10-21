import type { Prisma } from "../../packages/db/src/index.js";
import type { DatabaseClient, TransactionClient } from "../../packages/db/src/client.js";
import { DEV_ADMIN, DEV_CLASSES, DEV_STUDENTS } from "../../packages/db/src/seed-dev-data.js";
import {
  addDays,
  isoOf,
  requireValue,
  stableUuid,
  utcDate,
} from "../../packages/db/src/seed-dev-support.js";
import { ACTIVITY_ACTIONS } from "../../packages/api/src/activity/catalog.js";
import {
  orderedSnapshot,
  plannedItems,
  planningDates,
  type PlanningItem,
  type PlanningSnapshot,
} from "./stage-planning-data.js";

const REGULAR_REVISIONS = Object.values({
  oralReview: 1,
  redistribution: 5,
  removal: 9,
  repetition: 13,
});
const INDIVIDUAL_SCENARIOS = {
  detailedBefore: 18,
  intermediateBefore: 28,
  revisionBefore: 8,
  historicalDays: 52,
  historicalItems: 8,
  detailedItems: 18,
  intermediateItems: 8,
  minimumItems: 3,
};
const REGULAR_SCENARIOS = {
  detailedBefore: 12,
  intermediateBefore: 17,
  detailedItems: 32,
  intermediateItems: 12,
  minimumItems: 4,
};
const ITEM_COUNT_VARIATIONS = 3;
const DEADLINE_SCENARIOS = {
  crossYearBefore: 6,
  nextSemesterBefore: 8,
  pastBefore: 12,
  crossYearSpacingDays: 4,
  lateDurationDays: 45,
  byStartDays: 120,
  startVariations: 4,
  byTodayDays: 28,
  todayVariations: 6,
};
const DAYS_PER_WEEK = 7;
const TWO_WEEKS = 14;
const REVISION_AFTER_DAYS = 21;
const SECOND_REVISION_AFTER_DAYS = 35;
const REVISION_UTC_HOUR = 18;
const CREATION_UTC_HOUR = 3;
const REASONS = [
  "Reservar uma retomada oral antes de continuar a unidade.",
  "Redistribuir a carga planejada para respeitar o ritmo de aprendizagem.",
  "Retirar uma atividade do roteiro para concentrar tempo na prática oral.",
  "Retomar a mesma referência em outro encontro para ampliar a prática.",
];

type Staff = { id: string; name: string };
type ProgressRecord = Prisma.PedagogicalProgressGetPayload<{
  include: { stage: true; enrollment: { include: { student: true } } };
}>;
type Classroom = {
  id: string;
  internalCode: string;
  teacher: Staff;
  scheduleType: string;
  sharedStageId: string | null;
  semester: { startDate: Date; endDate: Date };
  scheduleSlots: { weekday: string }[];
};
type PlanContext = {
  id: string;
  classroom: Classroom;
  student: { id: string; fullName: string } | null;
  progressId: string | null;
  stageId: string;
  stageCode: string;
  startOn: string;
  endOn: string;
  historical: boolean;
  detailed: boolean;
  count: number;
  variation: number;
  revisionMode: number | null;
  revisionCount: number;
};
type ItemRecord = PlanningItem & { createdAt: Date; updatedAt: Date; deletedAt: Date | null };
type VersionRecord = {
  version: number;
  reason: string;
  snapshot: PlanningSnapshot;
  createdAt: Date;
  author: Staff;
};

/** Only part of the complete, coordinated pnpm seed reconstruction; no incremental entry point. */
export async function seedStagePlanning(database: DatabaseClient, todayIso: string): Promise<void> {
  const admin = await database.user.findUniqueOrThrow({
    where: { email: DEV_ADMIN.email },
    select: { id: true, name: true },
  });
  const classrooms = await database.class.findMany({
    where: { id: { in: DEV_CLASSES.map((row) => stableUuid(["class", row.key])) } },
    include: { teacher: { select: { id: true, name: true } }, semester: true, scheduleSlots: true },
  });
  const closedDays = await database.schoolClosedDay.findMany({ select: { date: true } });
  const closedDates = new Set(closedDays.map((row) => isoOf(row.date)));
  const contexts = regularContexts(classrooms);
  const personalized = classrooms.filter((row) => row.scheduleType === "PERSONALIZED");
  const progress = await database.pedagogicalProgress.findMany({
    where: {
      enrollment: {
        classId: { in: personalized.map((row) => row.id) },
        studentId: { in: DEV_STUDENTS.map((row) => stableUuid(["student", row.key])) },
      },
    },
    include: { stage: true, enrollment: { include: { student: true } } },
  });
  contexts.push(...individualContexts({ classrooms: personalized, progress, todayIso }));
  for (const context of contexts) {
    await database.$transaction((transaction) =>
      createPlan(transaction, { context, admin, todayIso, closedDates }),
    );
  }
}

function individualContexts(input: {
  classrooms: readonly Classroom[];
  progress: readonly ProgressRecord[];
  todayIso: string;
}): PlanContext[] {
  const contexts: PlanContext[] = [];
  let currentIndex = 0;
  for (const student of DEV_STUDENTS) {
    const studentId = stableUuid(["student", student.key]);
    const records = input.progress
      .filter((row) => row.enrollment.studentId === studentId)
      .toSorted((left, right) => left.startDate.getTime() - right.startDate.getTime());
    for (const row of records) {
      const historical = row.endDate !== null;
      const index = historical ? DEV_STUDENTS.indexOf(student) : currentIndex++;
      const classroom = requireValue(
        input.classrooms.find((entry) => entry.id === row.enrollment.classId),
        "PPT planning class",
      );
      contexts.push(
        individualContext({ row, classroom, historical, index, todayIso: input.todayIso }),
      );
    }
  }
  return contexts;
}

function individualContext(input: {
  row: ProgressRecord;
  classroom: Classroom;
  historical: boolean;
  index: number;
  todayIso: string;
}): PlanContext {
  const { row, classroom, historical, index, todayIso } = input;
  const startOn = isoOf(row.startDate);
  const detailed = historical || index < INDIVIDUAL_SCENARIOS.detailedBefore;
  return {
    id: stableUuid(["stage-plan", "individual", row.enrollment.studentId, row.stageId, startOn]),
    classroom,
    student: { id: row.enrollment.studentId, fullName: row.enrollment.student.fullName },
    progressId: row.id,
    stageId: row.stageId,
    stageCode: row.stage.internalCode,
    startOn,
    endOn: historical
      ? isoOf(addDays(row.startDate, INDIVIDUAL_SCENARIOS.historicalDays))
      : individualDeadline({ classroom, startOn, todayIso, index }),
    historical,
    detailed,
    count: individualItemCount({ historical, detailed, index }),
    variation: index,
    revisionMode:
      !historical && index < INDIVIDUAL_SCENARIOS.revisionBefore ? index % REASONS.length : null,
    revisionCount: individualRevisionCount({ historical, index }),
  };
}

function individualItemCount(input: {
  historical: boolean;
  detailed: boolean;
  index: number;
}): number {
  if (input.historical) return INDIVIDUAL_SCENARIOS.historicalItems;
  if (input.detailed)
    return INDIVIDUAL_SCENARIOS.detailedItems + (input.index % ITEM_COUNT_VARIATIONS) * 2;
  if (input.index < INDIVIDUAL_SCENARIOS.intermediateBefore)
    return INDIVIDUAL_SCENARIOS.intermediateItems + (input.index % ITEM_COUNT_VARIATIONS);
  return INDIVIDUAL_SCENARIOS.minimumItems;
}

function individualRevisionCount(input: { historical: boolean; index: number }): number {
  if (input.historical || input.index >= INDIVIDUAL_SCENARIOS.revisionBefore) return 0;
  return input.index < 2 ? 2 : 1;
}

function regularContexts(classrooms: readonly Classroom[]): PlanContext[] {
  const regular = DEV_CLASSES.filter((row) => row.scheduleType !== "PERSONALIZED");
  return regular.map((seed, index) => {
    const classroom = requireValue(
      classrooms.find((row) => row.id === stableUuid(["class", seed.key])),
      "regular planning class",
    );
    const revisionMode = REGULAR_REVISIONS.indexOf(index);
    return {
      id: stableUuid(["stage-plan", "class", classroom.id]),
      classroom,
      student: null,
      progressId: null,
      stageId: requireValue(classroom.sharedStageId ?? undefined, "regular planning stage"),
      stageCode: seed.stageInternalCode,
      startOn: isoOf(classroom.semester.startDate),
      endOn: isoOf(classroom.semester.endDate),
      historical: false,
      detailed: index < REGULAR_SCENARIOS.detailedBefore,
      count: regularItemCount(index),
      variation: index,
      revisionMode: revisionMode === -1 ? null : revisionMode,
      revisionCount: revisionMode === -1 ? 0 : 1,
    };
  });
}

function regularItemCount(index: number): number {
  if (index < REGULAR_SCENARIOS.detailedBefore)
    return REGULAR_SCENARIOS.detailedItems + (index % ITEM_COUNT_VARIATIONS) * 2;
  if (index < REGULAR_SCENARIOS.intermediateBefore)
    return REGULAR_SCENARIOS.intermediateItems + (index % ITEM_COUNT_VARIATIONS);
  return REGULAR_SCENARIOS.minimumItems;
}

function individualDeadline(input: {
  classroom: Classroom;
  startOn: string;
  todayIso: string;
  index: number;
}): string {
  const start = utcDate(input.startOn);
  if (input.index < DEADLINE_SCENARIOS.crossYearBefore) {
    // Long manual plans cross both semester and year, without creating future enrollments.
    const nextYear = utcDate(input.todayIso).getUTCFullYear() + 1;
    return isoOf(
      addDays(utcDate(`${nextYear}-02-01`), input.index * DEADLINE_SCENARIOS.crossYearSpacingDays),
    );
  }
  if (input.index < DEADLINE_SCENARIOS.nextSemesterBefore)
    return isoOf(
      addDays(
        input.classroom.semester.endDate,
        TWO_WEEKS + (input.index - DEADLINE_SCENARIOS.crossYearBefore) * DAYS_PER_WEEK,
      ),
    );
  if (
    input.index < DEADLINE_SCENARIOS.pastBefore &&
    addDays(start, TWO_WEEKS) < utcDate(input.todayIso)
  ) {
    const byDuration = addDays(start, DEADLINE_SCENARIOS.lateDurationDays);
    const alreadyPassed = addDays(utcDate(input.todayIso), -DAYS_PER_WEEK);
    return isoOf(new Date(Math.min(byDuration.getTime(), alreadyPassed.getTime())));
  }
  const byStart = addDays(
    start,
    DEADLINE_SCENARIOS.byStartDays + (input.index % DEADLINE_SCENARIOS.startVariations) * TWO_WEEKS,
  );
  const byToday = addDays(
    utcDate(input.todayIso),
    DEADLINE_SCENARIOS.byTodayDays +
      (input.index % DEADLINE_SCENARIOS.todayVariations) * DAYS_PER_WEEK,
  );
  const proposed = new Date(Math.max(byStart.getTime(), byToday.getTime()));
  const semesterEnd = input.classroom.semester.endDate;
  return isoOf(
    semesterEnd > addDays(utcDate(input.todayIso), TWO_WEEKS) && proposed > semesterEnd
      ? semesterEnd
      : proposed,
  );
}

type PlanInput = {
  context: PlanContext;
  admin: Staff;
  todayIso: string;
  closedDates: ReadonlySet<string>;
};
type PlanHistory = {
  createdAt: Date;
  records: Map<string, ItemRecord>;
  creationTimes: Map<string, Date>;
  snapshot: PlanningSnapshot;
  versions: VersionRecord[];
};

async function createPlan(transaction: TransactionClient, input: PlanInput): Promise<void> {
  const { context, admin } = input;
  const { snapshot, versions, records, createdAt } = buildPlanHistory(input);
  const latest = versions.at(-1)!;
  await transaction.stagePlan.create({
    data: {
      id: context.id,
      classId: context.student ? null : context.classroom.id,
      studentId: context.student?.id ?? null,
      stageId: context.stageId,
      plannedStartOn: utcDate(snapshot.plannedStartOn),
      plannedEndOn: utcDate(snapshot.plannedEndOn),
      objective: snapshot.objective,
      version: latest.version,
      createdById: admin.id,
      createdAt,
      updatedAt: latest.createdAt,
    },
  });
  await transaction.stagePlanItem.createMany({
    data: Array.from(records.values(), (row) => ({
      ...row,
      planId: context.id,
      plannedOn: utcDate(row.plannedOn),
    })),
  });
  await persistPlanRevisions(transaction, { context, versions });
  if (context.progressId) {
    await transaction.pedagogicalProgress.update({
      where: { id: context.progressId },
      data: { stagePlanId: context.id },
    });
  }
}

function initialPlanItems(context: PlanContext, closedDates: ReadonlySet<string>): PlanningItem[] {
  const dates = planningDates({
    startOn: context.startOn,
    endOn: context.endOn,
    weekdays: context.classroom.scheduleSlots.map((row) => row.weekday),
    closedDates,
  });
  return plannedItems({
    planId: context.id,
    dates,
    count: context.count,
    detailed: context.detailed,
    stageCode: context.stageCode,
    variation: context.variation,
  });
}

function buildPlanHistory(input: PlanInput): PlanHistory {
  const { context, admin } = input;
  const createdAt = schoolTimestamp(context.startOn, CREATION_UTC_HOUR);
  const items = initialPlanItems(context, input.closedDates);
  const records = new Map<string, ItemRecord>(
    items.map((item) => [item.id, { ...item, createdAt, updatedAt: createdAt, deletedAt: null }]),
  );
  const creationTimes = new Map(items.map((item) => [item.id, createdAt]));
  const snapshot = orderedSnapshot(
    {
      plannedStartOn: context.startOn,
      plannedEndOn: context.endOn,
      objective: planningObjective(context),
      items,
    },
    creationTimes,
  );
  const history: PlanHistory = {
    createdAt,
    records,
    creationTimes,
    snapshot,
    versions: [
      {
        version: 1,
        reason: "Planejamento inicial do estágio.",
        snapshot,
        createdAt,
        author: admin,
      },
    ],
  };
  for (let change = 0; change < context.revisionCount; change++) {
    if (!applyPlanRevision(history, { context, admin, todayIso: input.todayIso, change })) break;
  }
  return history;
}

function applyPlanRevision(
  history: PlanHistory,
  input: { context: PlanContext; admin: Staff; todayIso: string; change: number },
): boolean {
  const { context, admin, change } = input;
  const revisedOn = isoOf(
    addDays(
      utcDate(context.startOn),
      change === 0 ? REVISION_AFTER_DAYS : SECOND_REVISION_AFTER_DAYS,
    ),
  );
  if (revisedOn >= input.todayIso) return false;
  const revisedAt = schoolTimestamp(revisedOn, REVISION_UTC_HOUR);
  const revision = reviseSnapshot({ snapshot: history.snapshot, context, change, revisedOn });
  if (!revision) return false;
  history.snapshot = orderedSnapshot(revision.snapshot, history.creationTimes);
  reconcileItemRecords(history, revisedAt);
  history.versions.push({
    version: history.versions.length + 1,
    reason: revision.reason,
    snapshot: history.snapshot,
    createdAt: revisedAt,
    author: change === 0 ? context.classroom.teacher : admin,
  });
  return true;
}

function reconcileItemRecords(history: PlanHistory, revisedAt: Date): void {
  const remaining = new Set(history.snapshot.items.map((item) => item.id));
  for (const [id, row] of history.records) {
    const updated = history.snapshot.items.find((item) => item.id === id);
    if (updated && JSON.stringify(updated) !== JSON.stringify(itemSnapshot(row))) {
      history.records.set(id, { ...row, ...updated, updatedAt: revisedAt });
    } else if (!remaining.has(id) && row.deletedAt === null) {
      history.records.set(id, { ...row, deletedAt: revisedAt, updatedAt: revisedAt });
    }
  }
}

async function persistPlanRevisions(
  transaction: TransactionClient,
  input: { context: PlanContext; versions: readonly VersionRecord[] },
): Promise<void> {
  const { context } = input;
  for (const version of input.versions) {
    await transaction.stagePlanRevision.create({
      data: {
        id: stableUuid(["stage-plan-revision", context.id, String(version.version)]),
        planId: context.id,
        version: version.version,
        reason: version.reason,
        snapshot: version.snapshot,
        recordedById: version.author.id,
        createdAt: version.createdAt,
        updatedAt: version.createdAt,
      },
    });
    await planningActivity(transaction, { context, version });
  }
}

function reviseSnapshot(input: {
  snapshot: PlanningSnapshot;
  context: PlanContext;
  change: number;
  revisedOn: string;
}): { snapshot: PlanningSnapshot; reason: string } | null {
  const items = input.snapshot.items.map((row) => ({ ...row }));
  const index = items.findIndex(
    (row) => row.plannedOn >= input.revisedOn && row.kind === "CONTENT",
  );
  if (index === -1) return null;
  const mode = input.change > 0 ? 0 : input.context.revisionMode;
  let plannedEndOn = input.snapshot.plannedEndOn;
  let objective = input.snapshot.objective;
  switch (mode) {
    case 0: {
      replaceWithReview(items, index);
      break;
    }
    case 1: {
      if (input.context.student) plannedEndOn = isoOf(addDays(utcDate(plannedEndOn), TWO_WEEKS));
      objective = `${objective} Reservar mais tempo para prática e retomada das dificuldades.`;
      break;
    }
    case 2: {
      items.splice(index, 1);
      break;
    }
    default: {
      if (!repeatPreviousContent(items, index)) return null;
    }
  }
  return {
    snapshot: { ...input.snapshot, plannedEndOn, objective, items },
    reason:
      input.change > 0
        ? "Após nova organização, incluir outra revisão oral antes de avançar no livro."
        : REASONS[mode ?? 0]!,
  };
}

function replaceWithReview(items: PlanningItem[], index: number): void {
  items[index] = {
    ...items[index]!,
    kind: "REVIEW",
    title: "Revisão de perguntas e respostas com prática oral",
    pageFrom: null,
    pageTo: null,
  };
}

function repeatPreviousContent(items: PlanningItem[], index: number): boolean {
  const previous = items
    .slice(0, index)
    .toReversed()
    .find((row) => row.kind === "CONTENT");
  if (!previous) return false;
  items[index] = {
    ...items[index]!,
    title: "Prática adicional da unidade anterior",
    reference: previous.reference,
    pageFrom: previous.pageFrom,
    pageTo: previous.pageTo,
  };
  return true;
}

function planningObjective(context: PlanContext): string {
  if (context.stageCode.startsWith("MW"))
    return "Ampliar escuta e interação oral com histórias, jogos e atividades do livro.";
  return context.student
    ? "Consolidar compreensão, expressão oral e escrita, respeitando o ritmo individual do estágio."
    : "Organizar conteúdo, prática e avaliações do estágio ao longo do semestre.";
}

function itemSnapshot(row: ItemRecord): PlanningItem {
  const { createdAt: _createdAt, updatedAt: _updatedAt, deletedAt: _deletedAt, ...item } = row;
  return item;
}

function schoolTimestamp(iso: string, hour: number): Date {
  const instant = utcDate(iso);
  instant.setUTCHours(hour);
  return instant;
}

async function planningActivity(
  transaction: TransactionClient,
  input: { context: PlanContext; version: VersionRecord },
): Promise<void> {
  const { context, version } = input;
  const action = version.version === 1 ? "planning.create" : "planning.revise";
  const [area, title] = ACTIVITY_ACTIONS[action];
  const key = `stage-plan/${context.id}/${version.version}`;
  await transaction.activityEvent.create({
    data: {
      id: stableUuid(["activity", action, key]),
      deduplicationKey: key,
      occurredAt: version.createdAt,
      createdAt: version.createdAt,
      updatedAt: version.createdAt,
      actorId: version.author.id,
      actorName: version.author.name,
      area,
      action,
      title,
      subjectType: context.student ? "student" : "class",
      subjectId: context.student?.id ?? context.classroom.id,
      subjectName: context.student?.fullName ?? context.classroom.internalCode,
      description: version.reason,
    },
  });
}
