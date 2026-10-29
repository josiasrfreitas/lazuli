import { seedStudentIndex } from "./student-fixtures.js";
import type { Semester } from "../../packages/db/src/index.js";
import type { DatabaseClient } from "../../packages/db/src/client.js";
import { DEV_ADMIN, DEV_TEACHERS } from "../../packages/db/src/seed-dev-data.js";
import { isoOf } from "../../packages/db/src/seed-dev-support.js";
import { classScheduleSlotsInputSchema } from "../../packages/validators/src/class.js";
import { recordActivity } from "../../packages/api/src/activity/record.js";
import { readSemester } from "../../packages/api/src/semester-organization/queries.js";
import type { OrganizationContext } from "../../packages/api/src/semester-organization/data.js";
import {
  ORGANIZATION_GROUPS,
  organizationId,
  organizationInstant,
  type OrganizationGroup,
} from "./semester-organization-data.js";
import {
  placementSubject,
  proposalNotes,
  sourceCanPublish,
  type PlacementSubject,
} from "./semester-organization-sources.js";
import {
  placementRevision,
  publishOrganizationStudent,
  recordOrganizationProposal,
} from "./semester-organization-history.js";
import {
  organizationSemester,
  publishedOrganizationClass,
} from "./semester-organization-calendar.js";

const AUTHORING_DAYS = {
  planned: 14,

  proposed: 6,
  revised: 4,
  published: 2,
} as const;
const EXPECTED_PROPOSALS = 32;
const PUBLICATION_TIMEOUT_MS = 30_000;
const TERMINAL_STAGE_STUDENT = seedStudentIndex("school-student-76");
const ONLINE_ONLY_STUDENT = seedStudentIndex("school-student-224");
const REVISED_AFTERNOON_STUDENT = seedStudentIndex("school-student-135");
const REVISED_SCHEDULE_STUDENT = seedStudentIndex("occupancy-T2A-6");
type OrganizationEntry = { index: number; group: OrganizationGroup | null };
type OrganizationSeed = {
  database: DatabaseClient;
  todayIso: string;
  staffUser: OrganizationContext["staffUser"];
  dates: { [K in keyof typeof AUTHORING_DAYS]: Date };
  semester: Semester;
  teachers: Map<string, string>;
  entries: OrganizationEntry[];
  subjects: Map<number, PlacementSubject>;
};
type SelectedGroup = { group: OrganizationGroup; selected: PlacementSubject[] };

/** Only the coordinated, destructive pnpm seed invokes this loader; current schooling is preserved. */
export async function seedSemesterOrganization(
  database: DatabaseClient,
  todayIso: string,
): Promise<void> {
  const state = await organizationContext(database, todayIso);
  for (const group of ORGANIZATION_GROUPS) await createOrganizationPlan(state, group);
  for (const entry of state.entries) await proposeOrganizationStudent(state, entry);
  for (const index of [REVISED_AFTERNOON_STUDENT, REVISED_SCHEDULE_STUDENT])
    await reviseOrganizationStudent(state, index);
  await publishEligibleGroups(state);
}

async function organizationContext(
  database: DatabaseClient,
  todayIso: string,
): Promise<OrganizationSeed> {
  const staffUser = await database.user.findUniqueOrThrow({
    where: { email: DEV_ADMIN.email },
    select: { id: true, name: true, email: true, role: true, isEnabled: true },
  });
  const dates = {
    planned: organizationInstant(todayIso, AUTHORING_DAYS.planned),

    proposed: organizationInstant(todayIso, AUTHORING_DAYS.proposed),
    revised: organizationInstant(todayIso, AUTHORING_DAYS.revised),
    published: organizationInstant(todayIso, AUTHORING_DAYS.published),
  };
  const semester = await organizationSemester(database, {
    authoredAt: dates.planned,
    adminId: staffUser.id,
  });
  await recordActivity(database, {
    context: { staffUser, now: dates.planned },
    action: "calendar.createSemester",
    details: {
      subject: { type: "school", name: "Calendário escolar" },
      description: `Semestre ${semester.name}: ${isoOf(semester.startDate)} a ${isoOf(semester.endDate)}.`,
      deduplicationKey: `seed/semester-window/${semester.name}`,
    },
  });
  const teachers = await organizationTeachers(database);
  const entries: { index: number; group: OrganizationGroup | null }[] = ORGANIZATION_GROUPS.flatMap(
    (group) => [...group.published, ...group.pending].map((index) => ({ index, group })),
  );
  entries.push({ index: TERMINAL_STAGE_STUDENT, group: null });
  if (
    entries.length !== EXPECTED_PROPOSALS ||
    new Set(entries.map((row) => row.index)).size !== EXPECTED_PROPOSALS
  )
    throw new Error("Semester organization requires 32 distinct existing student fixtures.");
  const subjects = new Map<number, Awaited<ReturnType<typeof placementSubject>>>();
  for (const { index, group } of entries)
    subjects.set(index, await placementSubject(database, { index, group }));

  return { database, todayIso, staffUser, dates, semester, teachers, entries, subjects };
}

async function organizationTeachers(database: DatabaseClient): Promise<Map<string, string>> {
  const teachers = new Map<string, string>();
  for (const fixture of DEV_TEACHERS) {
    const teacher = await database.user.findUniqueOrThrow({
      where: { email: fixture.email },
      select: { id: true },
    });
    teachers.set(fixture.key, teacher.id);
  }
  return teachers;
}

async function createOrganizationPlan(
  state: OrganizationSeed,
  group: OrganizationGroup,
): Promise<void> {
  const { database, staffUser, dates, semester, teachers, subjects } = state;
  classScheduleSlotsInputSchema.parse(group.slots);
  const stageId =
    group.scheduleType === "REGULAR"
      ? subjects.get([...group.published, ...group.pending][0]!)!.stage!.id
      : null;
  const planId = organizationId("plan", { semesterName: semester.name, key: group.key });
  await database.semesterClassPlan.create({
    data: {
      id: planId,
      semesterId: semester.id,
      name: group.name,
      scheduleType: group.scheduleType,
      format: group.format,
      sharedStageId: stageId,
      teacherId: group.teacherKey ? teachers.get(group.teacherKey)! : null,
      slots: group.slots,
      version: 1,
      recordedById: staffUser.id,
      createdAt: dates.planned,
      updatedAt: dates.planned,
    },
  });
  await recordActivity(database, {
    context: { staffUser, now: dates.planned },
    action: "semesterOrganization.savePlan",
    details: {
      subject: { type: "school", name: "Organização do próximo semestre" },
      description: `${group.name} planejada para ${semester.name}; 120 minutos por semana.`,
      deduplicationKey: `seed/semester-plan/${planId}`,
    },
  });
}

async function proposeOrganizationStudent(
  state: OrganizationSeed,
  entry: OrganizationEntry,
): Promise<void> {
  const { database, staffUser, dates, semester, subjects } = state;
  const { index, group } = entry;
  const subject = subjects.get(index)!;
  // One draft changes group later; its initial intention remains in revision 1.
  const initialGroup = index === REVISED_AFTERNOON_STUDENT ? "ppt-b" : group?.key;
  const placementId = organizationId("placement", {
    semesterName: semester.name,
    key: subject.key,
  });
  await database.semesterPlacement.create({
    data: {
      id: placementId,
      semesterId: semester.id,
      planId: initialGroup
        ? organizationId("plan", { semesterName: semester.name, key: initialGroup })
        : null,
      studentId: subject.student.id,
      trackId: subject.trackId,
      stageId: subject.stage?.id ?? null,
      sourceEnrollmentId: subject.source?.id ?? null,
      sourceProgressId: subject.progress?.id ?? null,
      mode: subject.mode,
      notes: proposalNotes(subject),
      version: 1,
      recordedById: staffUser.id,
      createdAt: dates.proposed,
      updatedAt: dates.proposed,
    },
  });
  const context: OrganizationContext = { database, staffUser, now: dates.proposed };
  await placementRevision(context, {
    semesterName: semester.name,
    placementId,
    action: "PROPOSED",
  });
  await recordOrganizationProposal(context, { semesterName: semester.name, subject, version: 1 });
}

async function reviseOrganizationStudent(state: OrganizationSeed, index: number): Promise<void> {
  const { database, staffUser, dates, semester, subjects, entries } = state;
  const subject = subjects.get(index)!;
  const group = entries.find((row) => row.index === index)!.group!;
  const reason =
    index === REVISED_AFTERNOON_STUDENT
      ? "Ajustar a intenção para a primeira faixa da tarde; revise a data de entrada."
      : "Manter a proposta em rascunho até revisar a turma e o docente.";
  await database.$transaction(async (transaction) => {
    const context = { database: transaction, staffUser, now: dates.revised };
    const placementId = organizationId("placement", {
      semesterName: semester.name,
      key: subject.key,
    });
    await transaction.semesterPlacement.update({
      where: { id: placementId },
      data: {
        planId: organizationId("plan", { semesterName: semester.name, key: group.key }),
        notes: `${proposalNotes(subject)} ${reason}`,
        version: { increment: 1 },
        updatedAt: dates.revised,
      },
    });
    await placementRevision(context, {
      semesterName: semester.name,
      placementId,
      action: "REVISED",
      reason,
    });
    await recordOrganizationProposal(context, { semesterName: semester.name, subject, version: 2 });
  });
}

async function publishEligibleGroups(state: OrganizationSeed): Promise<void> {
  const { dates, semester, subjects } = state;

  let published = 0;
  let publishedGroups = 0;
  for (const group of ORGANIZATION_GROUPS.filter((row) => row.published.length > 0)) {
    const selected = group.published.map((index) => subjects.get(index)!);
    // Earlier calendar bootstraps may not yet contain the confirmed academic evidence.
    // Leave those intentions pending instead of manufacturing grades or a decision.
    if (
      !selected.every((subject) =>
        sourceCanPublish(subject, { publishedAt: dates.published, startsOn: semester.startDate }),
      )
    )
      continue;
    await publishOrganizationGroup(state, { group, selected });
    published += selected.length;
    publishedGroups += 1;
  }
  process.stdout.write(
    `Semester organization loaded: 8 plans, 32 proposals, ${published} future publications in ${publishedGroups} future classes.\n`,
  );
}

async function publishOrganizationGroup(
  state: OrganizationSeed,
  selection: SelectedGroup,
): Promise<void> {
  const { database, staffUser, dates, semester, teachers } = state;
  const { group, selected } = selection;
  await database.$transaction(
    async (transaction) => {
      const context = { database: transaction, staffUser, now: dates.published };
      const planId = organizationId("plan", { semesterName: semester.name, key: group.key });
      await assertGroupPublication(context, { semester, selected, group });
      const classroom = await publishedOrganizationClass({
        database: transaction,
        semester,
        group,
        teacherId: teachers.get(group.teacherKey!)!,
        stageId: group.scheduleType === "REGULAR" ? selected[0]!.stage!.id : null,
        previousClassId: selected[0]!.source!.classId,
        adminId: staffUser.id,
        publishedAt: dates.published,
      });
      await transaction.semesterClassPlan.update({
        where: { id: planId },
        data: {
          classId: classroom.id,
          version: { increment: 1 },
          updatedAt: dates.published,
        },
      });
      for (const subject of selected)
        await publishOrganizationStudent({
          context,
          semesterName: semester.name,
          entryDate: semester.startDate,
          subject,
          classId: classroom.id,
        });
      await recordPublishedGroup(context, { classroom, semester, selected, planId });
    },
    { timeout: PUBLICATION_TIMEOUT_MS },
  );
}

async function assertGroupPublication(
  context: OrganizationContext,
  input: SelectedGroup & { semester: Semester },
): Promise<void> {
  const { selected, semester, group } = input;
  const board = await readSemester(context, semester.id);
  const eligible = selected.map((subject) =>
    board.placements.find(
      (row) =>
        row.id === organizationId("placement", { semesterName: semester.name, key: subject.key }),
    ),
  );
  if (eligible.some((row) => !row || row.blockers.length > 0))
    throw new Error(
      `Semester seed publication violates the live eligibility contract for group ${group.key}.`,
    );
}

async function recordPublishedGroup(
  context: OrganizationContext,
  input: {
    classroom: { id: string; portalClassName: string };
    semester: Semester;
    selected: PlacementSubject[];
    planId: string;
  },
): Promise<void> {
  const { classroom, semester, selected, planId } = input;
  const transaction = context.database;
  await recordActivity(transaction, {
    context,
    action: "classes.create",
    details: {
      subject: { type: "class", id: classroom.id, name: classroom.portalClassName },
      description: `Turma de ${semester.name} criada na publicação da organização do semestre.`,
      deduplicationKey: `seed/semester-class/${classroom.id}`,
    },
  });
  await recordActivity(transaction, {
    context,
    action: "semesterOrganization.publish",
    details: {
      subject: { type: "class", id: classroom.id, name: classroom.portalClassName },
      description: `${selected.length} aluno(s) com entrada programada em ${isoOf(semester.startDate)}; as matrículas de origem permanecem vigentes até essa data.`,
      deduplicationKey: `seed/semester-publish/${planId}`,
    },
  });
}
