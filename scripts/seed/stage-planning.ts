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

const REGULAR_REVISIONS = [1, 5, 9, 13];
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
  let currentIndex = 0;
  for (const student of DEV_STUDENTS) {
    const studentId = stableUuid(["student", student.key]);
    const records = progress
      .filter((row) => row.enrollment.studentId === studentId)
      .sort((left, right) => left.startDate.getTime() - right.startDate.getTime());
    for (const row of records) {
      const historical = row.endDate !== null;
      const index = historical ? DEV_STUDENTS.indexOf(student) : currentIndex++;
      const classroom = requireValue(
        personalized.find((entry) => entry.id === row.enrollment.classId),
        "PPT planning class",
      );
      const startOn = isoOf(row.startDate);
      const detailed = historical || index < 18;
      contexts.push({
        id: stableUuid([
          "stage-plan",
          "individual",
          row.enrollment.studentId,
          row.stageId,
          startOn,
        ]),
        classroom,
        student: { id: row.enrollment.studentId, fullName: row.enrollment.student.fullName },
        progressId: row.id,
        stageId: row.stageId,
        stageCode: row.stage.internalCode,
        startOn,
        endOn: historical
          ? isoOf(addDays(row.startDate, 52))
          : individualDeadline({ classroom, startOn, todayIso, index }),
        historical,
        detailed,
        count: historical ? 8 : detailed ? 18 + (index % 3) * 2 : index < 28 ? 8 + (index % 3) : 3,
        variation: index,
        revisionMode: !historical && index < 8 ? index % REASONS.length : null,
        revisionCount: historical || index >= 8 ? 0 : index < 2 ? 2 : 1,
      });
    }
  }
  for (const context of contexts) {
    await database.$transaction((transaction) =>
      createPlan(transaction, { context, admin, todayIso, closedDates }),
    );
  }
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
      detailed: index < 12,
      count: index < 12 ? 32 + (index % 3) * 2 : index < 17 ? 12 + (index % 3) : 4,
      variation: index,
      revisionMode: revisionMode < 0 ? null : revisionMode,
      revisionCount: revisionMode < 0 ? 0 : 1,
    };
  });
}

function individualDeadline(input: {
  classroom: Classroom;
  startOn: string;
  todayIso: string;
  index: number;
}): string {
  const start = utcDate(input.startOn);
  if (input.index < 6) {
    // Long manual plans cross both semester and year, without creating future enrollments.
    const nextYear = utcDate(input.todayIso).getUTCFullYear() + 1;
    return isoOf(addDays(utcDate(`${nextYear}-02-01`), input.index * 4));
  }
  if (input.index < 8)
    return isoOf(addDays(input.classroom.semester.endDate, 14 + (input.index - 6) * 7));
  if (input.index < 12 && addDays(start, 14) < utcDate(input.todayIso)) {
    const byDuration = addDays(start, 45);
    const alreadyPassed = addDays(utcDate(input.todayIso), -7);
    return isoOf(byDuration < alreadyPassed ? byDuration : alreadyPassed);
  }
  const byStart = addDays(start, 120 + (input.index % 4) * 14);
  const byToday = addDays(utcDate(input.todayIso), 28 + (input.index % 6) * 7);
  const proposed = byStart > byToday ? byStart : byToday;
  const semesterEnd = input.classroom.semester.endDate;
  return isoOf(
    semesterEnd > addDays(utcDate(input.todayIso), 14) && proposed > semesterEnd
      ? semesterEnd
      : proposed,
  );
}

async function createPlan(
  transaction: TransactionClient,
  input: {
    context: PlanContext;
    admin: Staff;
    todayIso: string;
    closedDates: ReadonlySet<string>;
  },
): Promise<void> {
  const { context, admin } = input;
  const dates = planningDates({
    startOn: context.startOn,
    endOn: context.endOn,
    weekdays: context.classroom.scheduleSlots.map((row) => row.weekday),
    closedDates: input.closedDates,
  });
  const createdAt = schoolTimestamp(context.startOn, CREATION_UTC_HOUR);
  const items = plannedItems({
    planId: context.id,
    dates,
    count: context.count,
    detailed: context.detailed,
    stageCode: context.stageCode,
    variation: context.variation,
  });
  const records = new Map<string, ItemRecord>(
    items.map((item) => [item.id, { ...item, createdAt, updatedAt: createdAt, deletedAt: null }]),
  );
  const creationTimes = new Map(items.map((item) => [item.id, createdAt]));
  let snapshot: PlanningSnapshot = orderedSnapshot(
    {
      plannedStartOn: context.startOn,
      plannedEndOn: context.endOn,
      objective: planningObjective(context),
      items,
    },
    creationTimes,
  );
  const versions: VersionRecord[] = [
    {
      version: 1,
      reason: "Planejamento inicial do estágio.",
      snapshot,
      createdAt,
      author: admin,
    },
  ];
  for (let change = 0; change < context.revisionCount; change++) {
    const revisedOn = isoOf(
      addDays(
        utcDate(context.startOn),
        change === 0 ? REVISION_AFTER_DAYS : SECOND_REVISION_AFTER_DAYS,
      ),
    );
    if (revisedOn >= input.todayIso) break;
    const revisedAt = schoolTimestamp(revisedOn, REVISION_UTC_HOUR);
    const revision = reviseSnapshot({ snapshot, context, change, revisedOn });
    if (!revision) break;
    snapshot = orderedSnapshot(revision.snapshot, creationTimes);
    const remaining = new Set(snapshot.items.map((item) => item.id));
    for (const [id, row] of records) {
      const updated = snapshot.items.find((item) => item.id === id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(itemSnapshot(row))) {
        records.set(id, { ...row, ...updated, updatedAt: revisedAt });
      } else if (!remaining.has(id) && row.deletedAt === null) {
        records.set(id, { ...row, deletedAt: revisedAt, updatedAt: revisedAt });
      }
    }
    versions.push({
      version: versions.length + 1,
      reason: revision.reason,
      snapshot,
      createdAt: revisedAt,
      author: change === 0 ? context.classroom.teacher : admin,
    });
  }
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
  for (const version of versions) {
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
    await planningActivity(transaction, context, version);
  }
  if (context.progressId) {
    await transaction.pedagogicalProgress.update({
      where: { id: context.progressId },
      data: { stagePlanId: context.id },
    });
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
  if (index < 0) return null;
  const mode = input.change > 0 ? 0 : input.context.revisionMode;
  let plannedEndOn = input.snapshot.plannedEndOn;
  let objective = input.snapshot.objective;
  if (mode === 0) {
    items[index] = {
      ...items[index]!,
      kind: "REVIEW",
      title: "Revisão de perguntas e respostas com prática oral",
      pageFrom: null,
      pageTo: null,
    };
  } else if (mode === 1) {
    if (input.context.student) plannedEndOn = isoOf(addDays(utcDate(plannedEndOn), 14));
    objective = `${objective} Reservar mais tempo para prática e retomada das dificuldades.`;
  } else if (mode === 2) {
    items.splice(index, 1);
  } else {
    const previous = items
      .slice(0, index)
      .reverse()
      .find((row) => row.kind === "CONTENT");
    if (!previous) return null;
    items[index] = {
      ...items[index]!,
      title: "Prática adicional da unidade anterior",
      reference: previous.reference,
      pageFrom: previous.pageFrom,
      pageTo: previous.pageTo,
    };
  }
  return {
    snapshot: { ...input.snapshot, plannedEndOn, objective, items },
    reason:
      input.change > 0
        ? "Após nova organização, incluir outra revisão oral antes de avançar no livro."
        : REASONS[mode ?? 0]!,
  };
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
  context: PlanContext,
  version: VersionRecord,
): Promise<void> {
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
