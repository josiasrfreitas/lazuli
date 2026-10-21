import { createHash } from "node:crypto";
import type { DatabaseClient, Prisma } from "@lazuli/db";
import { assertTeachingProgram, type TeachingProgramImport } from "@lazuli/domain";
import { teachingProgramImportSchema } from "@lazuli/validators";

type Transaction = Prisma.TransactionClient;
type ImportResult = { id: string; imported: boolean };
const IMPORT_TIMEOUT_MS = 60_000;

/** Trusted manual integration entry point; never an interactive catalog mutation. */
export async function importTeachingProgram(
  database: DatabaseClient,
  payload: TeachingProgramImport,
): Promise<ImportResult> {
  const input: TeachingProgramImport = teachingProgramImportSchema.parse(payload);
  assertTeachingProgram(input);
  const contentHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return database.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`program-import:${input.stageId}`}, 0)) IS NULL AS locked`;
      const prepared = await prepareRevision(tx, { input, contentHash });
      if (prepared.existing) return { id: prepared.existing.id, imported: false };
      const lessonIds = await importLessons(tx, input);
      const programId = await createRevision(tx, {
        input,
        modalityId: prepared.modalityId,
        contentHash,
      });
      await importGraph(tx, { input, programId, lessonIds });
      return { id: programId, imported: true };
    },
    { timeout: IMPORT_TIMEOUT_MS },
  );
}

async function prepareRevision(
  tx: Transaction,
  { input, contentHash }: { input: TeachingProgramImport; contentHash: string },
): Promise<{ modalityId: string; existing: { id: string } | null }> {
  await tx.stage.findFirstOrThrow({ where: { id: input.stageId, deletedAt: null } });
  const modality = await tx.teachingModality.upsert({
    where: { code: input.modality.code },
    create: input.modality,
    update: {},
  });
  if (modality.deletedAt || modality.weeklyMinutes !== input.modality.weeklyMinutes)
    throw new Error("A modalidade já existe com outra carga. Importe uma modalidade diferente.");
  const existing = await tx.teachingProgram.findFirst({
    where: {
      stageId: input.stageId,
      modalityId: modality.id,
      scheduleType: input.scheduleType,
      sourceProvider: input.source.provider,
      sourceReference: input.source.reference,
      sourceRevision: input.source.revision,
    },
  });
  if (existing && existing.contentHash !== contentHash)
    throw new Error(
      "A revisão da fonte mudou. Informe uma nova revisão para preservar o histórico.",
    );
  return { modalityId: modality.id, existing };
}

async function importLessons(
  tx: Transaction,
  input: TeachingProgramImport,
): Promise<Map<string, string>> {
  const currentLessons = await tx.bookLesson.findMany({ where: { stageId: input.stageId } });
  // A new revision cannot rewrite the meaning of a lesson referenced by older programs.
  if (
    currentLessons.length > 0 &&
    (currentLessons.length !== input.lessons.length ||
      currentLessons.some(
        (lesson) =>
          !input.lessons.some(
            (next) =>
              next.key === lesson.sourceKey &&
              next.sequence === lesson.sequence &&
              next.title === lesson.title,
          ),
      ))
  )
    throw new Error(
      "As lições do livro divergem do catálogo existente. A nova edição precisa de reconciliação explícita.",
    );
  const lessonIds = new Map<string, string>();
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

async function createRevision(
  tx: Transaction,
  {
    input,
    modalityId,
    contentHash,
  }: { input: TeachingProgramImport; modalityId: string; contentHash: string },
): Promise<string> {
  await tx.teachingProgram.updateMany({
    where: {
      stageId: input.stageId,
      modalityId,
      scheduleType: input.scheduleType,
      retiredAt: null,
    },
    data: { retiredAt: new Date() },
  });
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
  return program.id;
}

type GraphInput = {
  input: TeachingProgramImport;
  programId: string;
  lessonIds: Map<string, string>;
};
async function importGraph(
  tx: Transaction,
  { input, programId, lessonIds }: GraphInput,
): Promise<void> {
  const unitIds = new Map<string, string>();
  for (const unit of input.units) {
    const row = await tx.programUnit.create({
      data: {
        programId: programId,
        sourceKey: unit.key,
        sequence: unit.sequence,
        title: unit.title,
      },
    });
    unitIds.set(unit.key, row.id);
  }
  const teachingHourIds = new Map<string, string>();
  for (const entry of input.teachingHours) {
    const row = await tx.teachingHour.create({
      data: {
        programId: programId,
        sourceKey: entry.key,
        sequence: entry.sequence,
        durationMinutes: entry.durationMinutes,
      },
    });
    teachingHourIds.set(entry.key, row.id);
  }
  const assessmentIds = new Map<string, string>();
  for (const assessment of input.assessments) {
    const row = await tx.programAssessment.create({
      data: {
        programId: programId,
        unitId: unitIds.get(assessment.unitKey)!,
        sourceKey: assessment.key,
        sequence: assessment.sequence,
        title: assessment.title,
      },
    });
    assessmentIds.set(assessment.key, row.id);
  }
  await importActivities(tx, {
    input,
    programId,
    lessonIds,
    unitIds,
    teachingHourIds,
    assessmentIds,
  });
}

async function importActivities(
  tx: Transaction,
  {
    input,
    programId,
    lessonIds,
    unitIds,
    teachingHourIds,
    assessmentIds,
  }: GraphInput & {
    unitIds: Map<string, string>;
    teachingHourIds: Map<string, string>;
    assessmentIds: Map<string, string>;
  },
): Promise<void> {
  for (const activity of input.activities) {
    await tx.programActivity.create({
      data: {
        programId: programId,
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
