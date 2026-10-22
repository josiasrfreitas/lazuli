import { createHash } from "node:crypto";
import type { DatabaseClient, Prisma } from "@lazuli/db";
import { assertTeachingProgram, type TeachingProgramImport } from "@lazuli/domain";
import { teachingProgramImportSchema } from "@lazuli/validators";

const MILLISECONDS_PER_MINUTE = 60_000;
type Database = Prisma.TransactionClient;
type ImportResult = { id: string; imported: boolean };
type ProgramIds = {
  lessonIds: Map<string, string>;
  unitIds: Map<string, string>;
  teachingHourIds: Map<string, string>;
  assessmentIds: Map<string, string>;
};

/** Integration entry point. Not exposed as an interactive catalog mutation. */
export async function importTeachingProgram(
  database: DatabaseClient,
  payload: TeachingProgramImport,
): Promise<ImportResult> {
  const input: TeachingProgramImport = teachingProgramImportSchema.parse(payload);
  assertTeachingProgram(input);
  const contentHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return database.$transaction(async (tx) => persistTeachingProgram(tx, { input, contentHash }), {
    timeout: MILLISECONDS_PER_MINUTE,
  });
}

async function persistTeachingProgram(
  tx: Database,
  { input, contentHash }: { input: TeachingProgramImport; contentHash: string },
): Promise<ImportResult> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`program-import:${input.stageId}`}, 0)) IS NULL AS locked`;
  await tx.stage.findFirstOrThrow({ where: { id: input.stageId, deletedAt: null } });
  const modalityId = await ensureModality(tx, input);
  const existing = await existingProgram(tx, { input, modalityId, contentHash });
  if (existing) return existing;
  const lessonIds = await importBookLessons(tx, input);
  await retireCurrentProgram(tx, { input, modalityId });
  const program = await tx.teachingProgram.create({
    data: {
      stageId: input.stageId,
      modalityId,
      scheduleType: input.scheduleType,
      sourceProvider: input.source.provider,
      sourceReference: input.source.reference,
      sourceRevision: input.source.revision,
      contentHash,
    },
  });
  const unitIds = await importUnits(tx, { programId: program.id, input });
  const teachingHourIds = await importTeachingHours(tx, { programId: program.id, input });
  const assessmentIds = await importAssessments(tx, { programId: program.id, unitIds, input });
  await importActivities(tx, {
    programId: program.id,
    input,
    lessonIds,
    unitIds,
    teachingHourIds,
    assessmentIds,
  });
  return { id: program.id, imported: true };
}

async function ensureModality(tx: Database, input: TeachingProgramImport): Promise<string> {
  const modality = await tx.teachingModality.upsert({
    where: { code: input.modality.code },
    create: input.modality,
    update: {},
  });
  if (modality.deletedAt || modality.weeklyMinutes !== input.modality.weeklyMinutes)
    throw new Error("A modalidade já existe com outra carga. Importe uma modalidade diferente.");
  return modality.id;
}

async function existingProgram(
  tx: Database,
  {
    input,
    modalityId,
    contentHash,
  }: { input: TeachingProgramImport; modalityId: string; contentHash: string },
): Promise<ImportResult | null> {
  const existing = await tx.teachingProgram.findFirst({
    where: {
      stageId: input.stageId,
      modalityId,
      scheduleType: input.scheduleType,
      sourceProvider: input.source.provider,
      sourceReference: input.source.reference,
      sourceRevision: input.source.revision,
    },
  });
  if (!existing) return null;
  if (existing.contentHash !== contentHash)
    throw new Error(
      "A revisão da fonte mudou. Informe uma nova revisão para preservar o histórico.",
    );
  return { id: existing.id, imported: false };
}

function lessonsMatch(
  current: { sourceKey: string; sequence: number; title: string }[],
  incoming: TeachingProgramImport["lessons"],
): boolean {
  if (current.length === 0) return true;
  if (current.length !== incoming.length) return false;
  return current.every((lesson) =>
    incoming.some(
      (next) =>
        next.key === lesson.sourceKey &&
        next.sequence === lesson.sequence &&
        next.title === lesson.title,
    ),
  );
}

async function importBookLessons(
  tx: Database,
  input: TeachingProgramImport,
): Promise<Map<string, string>> {
  const lessonIds = new Map<string, string>();
  const currentLessons = await tx.bookLesson.findMany({ where: { stageId: input.stageId } });
  // Catalog revisions must not silently change the meaning of previously referenced lessons.
  if (!lessonsMatch(currentLessons, input.lessons))
    throw new Error(
      "As lições do livro divergem do catálogo existente. A nova edição precisa de reconciliação explícita.",
    );
  for (const lesson of input.lessons) {
    const row = await tx.bookLesson.upsert({
      where: { stageId_sourceKey: { stageId: input.stageId, sourceKey: lesson.key } },
      create: {
        stageId: input.stageId,
        sourceKey: lesson.key,
        sequence: lesson.sequence,
        title: lesson.title,
      },
      update: {},
    });
    lessonIds.set(lesson.key, row.id);
  }
  await tx.stage.update({
    where: { id: input.stageId },
    data: { bookLessonCount: input.lessons.length },
  });
  return lessonIds;
}

async function retireCurrentProgram(
  tx: Database,
  { input, modalityId }: { input: TeachingProgramImport; modalityId: string },
): Promise<void> {
  await tx.teachingProgram.updateMany({
    where: {
      stageId: input.stageId,
      modalityId,
      scheduleType: input.scheduleType,
      retiredAt: null,
    },
    data: { retiredAt: new Date() },
  });
}

async function importUnits(
  tx: Database,
  { programId, input }: { programId: string; input: TeachingProgramImport },
): Promise<Map<string, string>> {
  const unitIds = new Map<string, string>();
  for (const unit of input.units) {
    const row = await tx.programUnit.create({
      data: { programId, sourceKey: unit.key, sequence: unit.sequence, title: unit.title },
    });
    unitIds.set(unit.key, row.id);
  }
  return unitIds;
}

async function importTeachingHours(
  tx: Database,
  { programId, input }: { programId: string; input: TeachingProgramImport },
): Promise<Map<string, string>> {
  const teachingHourIds = new Map<string, string>();
  for (const entry of input.teachingHours) {
    const row = await tx.teachingHour.create({
      data: {
        programId,
        sourceKey: entry.key,
        sequence: entry.sequence,
        durationMinutes: entry.durationMinutes,
      },
    });
    teachingHourIds.set(entry.key, row.id);
  }
  return teachingHourIds;
}

async function importAssessments(
  tx: Database,
  {
    programId,
    unitIds,
    input,
  }: {
    programId: string;
    unitIds: Map<string, string>;
    input: TeachingProgramImport;
  },
): Promise<Map<string, string>> {
  const assessmentIds = new Map<string, string>();
  for (const assessment of input.assessments) {
    const row = await tx.programAssessment.create({
      data: {
        programId,
        unitId: unitIds.get(assessment.unitKey)!,
        sourceKey: assessment.key,
        sequence: assessment.sequence,
        title: assessment.title,
      },
    });
    assessmentIds.set(assessment.key, row.id);
  }
  return assessmentIds;
}

async function importActivities(
  tx: Database,
  {
    programId,
    input,
    lessonIds,
    unitIds,
    teachingHourIds,
    assessmentIds,
  }: {
    programId: string;
    input: TeachingProgramImport;
  } & ProgramIds,
): Promise<void> {
  for (const activity of input.activities) {
    await tx.programActivity.create({
      data: {
        programId,
        sourceKey: activity.key,
        sequence: activity.sequence,
        teachingHourId: teachingHourIds.get(activity.teachingHourKey)!,
        unitId: unitIds.get(activity.unitKey)!,
        assessmentId: activity.assessmentKey ? assessmentIds.get(activity.assessmentKey)! : null,
        durationMinutes: activity.durationMinutes,
        kind: activity.kind,
        title: activity.title,
        sourceCode: activity.sourceCode,
        descriptionPending: activity.descriptionPending,
        lessons: {
          create: activity.lessons.map((lesson) => ({
            lessonId: lessonIds.get(lesson.key)!,
            part: lesson.part ?? "",
          })),
        },
      },
    });
  }
}
