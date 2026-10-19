import type { Prisma } from "@lazuli/db";

type Database = Pick<Prisma.TransactionClient, "stage">;
const programInclude = {
  modality: true,
  teachingHours: {
    where: { deletedAt: null },
    orderBy: { sequence: "asc" },
    include: {
      activities: {
        where: { deletedAt: null },
        orderBy: { sequence: "asc" },
        include: {
          lessons: {
            where: { deletedAt: null },
            orderBy: [{ lesson: { sequence: "asc" } }, { part: "asc" }],
            include: { lesson: true },
          },
          assessment: true,
        },
      },
    },
  },
  units: { where: { deletedAt: null }, orderBy: { sequence: "asc" } },
  assessments: { where: { deletedAt: null }, orderBy: { sequence: "asc" } },
} satisfies Prisma.TeachingProgramInclude;

export async function readStageCatalog(database: Database) {
  return database.stage.findMany({
    where: { deletedAt: null, track: { deletedAt: null, productLine: { deletedAt: null } } },
    orderBy: [{ track: { name: "asc" } }, { sequence: "asc" }],
    select: {
      id: true,
      name: true,
      internalCode: true,
      bookLessonCount: true,
      track: { select: { id: true, name: true, ageGroup: true, status: true } },
      _count: { select: { teachingPrograms: { where: { deletedAt: null, retiredAt: null } } } },
    },
  });
}

export async function readStageProgram(database: Database, id: string) {
  const stage = await database.stage.findFirst({
    where: { id, deletedAt: null, track: { deletedAt: null, productLine: { deletedAt: null } } },
    include: {
      track: { select: { id: true, name: true, ageGroup: true, status: true } },
      bookLessons: { where: { deletedAt: null }, orderBy: { sequence: "asc" } },
      teachingPrograms: {
        where: { deletedAt: null, retiredAt: null },
        orderBy: [{ scheduleType: "asc" }, { modality: { weeklyMinutes: "asc" } }],
        include: programInclude,
      },
    },
  });
  if (!stage) return null;
  return {
    id: stage.id,
    name: stage.name,
    internalCode: stage.internalCode,
    track: stage.track,
    lessonCount: stage.bookLessonCount,
    lessons: stage.bookLessons.map((lesson) => ({
      id: lesson.id,
      sequence: lesson.sequence,
      title: lesson.title,
    })),
    programs: stage.teachingPrograms.map((program) => ({
      id: program.id,
      scheduleType: program.scheduleType,
      modality: {
        id: program.modality.id,
        name: program.modality.name,
        weeklyMinutes: program.modality.weeklyMinutes,
      },
      source: {
        provider: program.sourceProvider,
        reference: program.sourceReference,
        revision: program.sourceRevision,
      },
      teachingHourCount: program.teachingHours.length,
      totalMinutes: program.teachingHours.reduce(
        (total, entry) => total + entry.durationMinutes,
        0,
      ),
      unitCount: program.units.length,
      assessmentCount: program.assessments.length,
      unresolvedActivityCount: program.teachingHours
        .flatMap((entry) => entry.activities)
        .filter((activity) => activity.descriptionPending).length,
      units: program.units.map((unit) => ({
        id: unit.id,
        sequence: unit.sequence,
        title: unit.title,
        teachingHours: program.teachingHours.flatMap((entry) => {
          const activities = entry.activities.filter((activity) => activity.unitId === unit.id);
          if (!activities.length) return [];
          return [
            {
              id: entry.id,
              sequence: entry.sequence,
              durationMinutes: entry.durationMinutes,
              unitMinutes: activities.reduce(
                (total, activity) => total + activity.durationMinutes,
                0,
              ),
              activities: activities.map((activity) => ({
                id: activity.id,
                kind: activity.kind,
                title: activity.title,
                durationMinutes: activity.durationMinutes,
                sourceCode: activity.sourceCode,
                descriptionPending: activity.descriptionPending,
                assessment: activity.assessment
                  ? {
                      id: activity.assessment.id,
                      sequence: activity.assessment.sequence,
                      title: activity.assessment.title,
                    }
                  : null,
                lessons: activity.lessons.map(({ part, lesson }) => ({
                  id: lesson.id,
                  sequence: lesson.sequence,
                  title: lesson.title,
                  part: part || null,
                })),
              })),
            },
          ];
        }),
      })),
    })),
  };
}
