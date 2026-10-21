import { createHash } from "node:crypto";
import type { DatabaseClient } from "@lazuli/db";
import { assertTeachingProgram, type TeachingProgramImport } from "@lazuli/domain";
import { teachingProgramImportSchema } from "@lazuli/validators";

/** Integration entry point. Not exposed as an interactive catalog mutation. */
export async function importTeachingProgram(database: DatabaseClient, payload: unknown) {
  const input: TeachingProgramImport = teachingProgramImportSchema.parse(payload);
  assertTeachingProgram(input);
  const contentHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return database.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`program-import:${input.stageId}`}, 0)) IS NULL AS locked`;
      await tx.stage.findFirstOrThrow({ where: { id: input.stageId, deletedAt: null } });
      const modality = await tx.teachingModality.upsert({
        where: { code: input.modality.code },
        create: input.modality,
        update: {},
      });
      if (modality.deletedAt || modality.weeklyMinutes !== input.modality.weeklyMinutes)
        throw new Error(
          "A modalidade já existe com outra carga. Importe uma modalidade diferente.",
        );
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
      if (existing) {
        if (existing.contentHash !== contentHash)
          throw new Error(
            "A revisão da fonte mudou. Informe uma nova revisão para preservar o histórico.",
          );
        return { id: existing.id, imported: false };
      }
      const lessonIds = new Map<string, string>();
      const currentLessons = await tx.bookLesson.findMany({ where: { stageId: input.stageId } });
      // Catalog revisions must not silently change the meaning of previously referenced lessons.
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
      await tx.teachingProgram.updateMany({
        where: {
          stageId: input.stageId,
          modalityId: modality.id,
          scheduleType: input.scheduleType,
          retiredAt: null,
        },
        data: { retiredAt: new Date() },
      });
      const program = await tx.teachingProgram.create({
        data: {
          stageId: input.stageId,
          modalityId: modality.id,
          scheduleType: input.scheduleType,
          sourceProvider: input.source.provider,
          sourceReference: input.source.reference,
          sourceRevision: input.source.revision,
          contentHash,
        },
      });
      const unitIds = new Map<string, string>();
      for (const unit of input.units) {
        const row = await tx.programUnit.create({
          data: {
            programId: program.id,
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
            programId: program.id,
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
            programId: program.id,
            unitId: unitIds.get(assessment.unitKey)!,
            sourceKey: assessment.key,
            sequence: assessment.sequence,
            title: assessment.title,
          },
        });
        assessmentIds.set(assessment.key, row.id);
      }
      for (const activity of input.activities) {
        await tx.programActivity.create({
          data: {
            programId: program.id,
            sourceKey: activity.key,
            sequence: activity.sequence,
            teachingHourId: teachingHourIds.get(activity.teachingHourKey)!,
            unitId: unitIds.get(activity.unitKey)!,
            assessmentId: activity.assessmentKey
              ? assessmentIds.get(activity.assessmentKey)!
              : null,
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
      return { id: program.id, imported: true };
    },
    { timeout: 60_000 },
  );
}
