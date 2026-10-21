import type { StageProgramDetail, StageSummary, ProgramDetail, ActivityDetail } from "./types.js";
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

const catalogSelect = {
  id: true,
  name: true,
  internalCode: true,
  bookLessonCount: true,
  track: { select: { id: true, name: true, ageGroup: true, status: true } },
  _count: { select: { teachingPrograms: { where: { deletedAt: null, retiredAt: null } } } },
} satisfies Prisma.StageSelect;

export async function readStageCatalog(database: Database): Promise<StageSummary[]> {
  return database.stage.findMany({
    where: { deletedAt: null, track: { deletedAt: null, productLine: { deletedAt: null } } },
    orderBy: [{ track: { name: "asc" } }, { sequence: "asc" }],
    select: catalogSelect,
  });
}

export async function readStageProgram(
  database: Database,
  id: string,
): Promise<StageProgramDetail | null> {
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
    programs: stage.teachingPrograms.map((program) => mapProgram(program)),
  };
}

type ProgramRow = Prisma.TeachingProgramGetPayload<{ include: typeof programInclude }>;
type HourRow = ProgramRow["teachingHours"][number];
type ActivityRow = HourRow["activities"][number];
function mapProgram(program: ProgramRow): ProgramDetail {
  return {
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
    totalMinutes: program.teachingHours.reduce((total, entry) => total + entry.durationMinutes, 0),
    unitCount: program.units.length,
    assessmentCount: program.assessments.length,
    unresolvedActivityCount: program.teachingHours
      .flatMap((entry) => entry.activities)
      .filter((activity) => activity.descriptionPending).length,
    units: program.units.map((unit) => ({
      id: unit.id,
      sequence: unit.sequence,
      title: unit.title,
      teachingHours: program.teachingHours.flatMap((entry) => mapHour(entry, unit.id)),
    })),
  };
}

function mapHour(entry: HourRow, unitId: string): ProgramDetail["units"][number]["teachingHours"] {
  const activities = entry.activities.filter((activity) => activity.unitId === unitId);
  if (activities.length === 0) return [];
  return [
    {
      id: entry.id,
      sequence: entry.sequence,
      durationMinutes: entry.durationMinutes,
      unitMinutes: activities.reduce((total, activity) => total + activity.durationMinutes, 0),
      activities: activities.map((activity) => mapActivity(activity)),
    },
  ];
}

function mapActivity(activity: ActivityRow): ActivityDetail {
  return {
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
  };
}
