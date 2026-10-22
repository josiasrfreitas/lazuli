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
const stageProgramInclude = {
  track: { select: { id: true, name: true, ageGroup: true, status: true } },
  bookLessons: { where: { deletedAt: null }, orderBy: { sequence: "asc" } },
  teachingPrograms: {
    where: { deletedAt: null, retiredAt: null },
    orderBy: [{ scheduleType: "asc" }, { modality: { weeklyMinutes: "asc" } }],
    include: programInclude,
  },
} satisfies Prisma.StageInclude;

type CatalogRow = Prisma.StageGetPayload<{ select: typeof catalogSelect }>;
type StageRow = Prisma.StageGetPayload<{ include: typeof stageProgramInclude }>;
type ProgramRow = StageRow["teachingPrograms"][number];
type UnitRow = ProgramRow["units"][number];
type HourRow = ProgramRow["teachingHours"][number];
type ActivityRow = HourRow["activities"][number];
type LessonLink = ActivityRow["lessons"][number];
type ActivityView = Pick<
  ActivityRow,
  "id" | "kind" | "title" | "durationMinutes" | "sourceCode" | "descriptionPending"
> & {
  assessment: Pick<NonNullable<ActivityRow["assessment"]>, "id" | "sequence" | "title"> | null;
  lessons: (Pick<LessonLink["lesson"], "id" | "sequence" | "title"> & {
    part: string | null;
  })[];
};
type TeachingHourView = Pick<HourRow, "id" | "sequence" | "durationMinutes"> & {
  unitMinutes: number;
  activities: ActivityView[];
};
type UnitView = Pick<UnitRow, "id" | "sequence" | "title"> & {
  teachingHours: TeachingHourView[];
};
type ProgramView = Pick<ProgramRow, "id" | "scheduleType"> & {
  modality: Pick<ProgramRow["modality"], "id" | "name" | "weeklyMinutes">;
  source: {
    provider: ProgramRow["sourceProvider"];
    reference: ProgramRow["sourceReference"];
    revision: ProgramRow["sourceRevision"];
  };
  teachingHourCount: number;
  totalMinutes: number;
  unitCount: number;
  assessmentCount: number;
  unresolvedActivityCount: number;
  units: UnitView[];
};
type StageProgramView = Pick<StageRow, "id" | "name" | "internalCode" | "track"> & {
  lessonCount: StageRow["bookLessonCount"];
  lessons: Pick<StageRow["bookLessons"][number], "id" | "sequence" | "title">[];
  programs: ProgramView[];
};

export async function readStageCatalog(database: Database): Promise<CatalogRow[]> {
  return database.stage.findMany({
    where: { deletedAt: null, track: { deletedAt: null, productLine: { deletedAt: null } } },
    orderBy: [{ track: { name: "asc" } }, { sequence: "asc" }],
    select: catalogSelect,
  });
}

export async function readStageProgram(
  database: Database,
  id: string,
): Promise<StageProgramView | null> {
  const stage = await database.stage.findFirst({
    where: { id, deletedAt: null, track: { deletedAt: null, productLine: { deletedAt: null } } },
    include: stageProgramInclude,
  });
  return stage ? projectStageProgram(stage) : null;
}

function projectStageProgram(stage: StageRow): StageProgramView {
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
    programs: stage.teachingPrograms.map((program) => projectProgram(program)),
  };
}

function projectProgram(program: ProgramRow): ProgramView {
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
    units: program.units.map((unit) => projectUnit(program, unit)),
  };
}

function projectUnit(program: ProgramRow, unit: UnitRow): UnitView {
  return {
    id: unit.id,
    sequence: unit.sequence,
    title: unit.title,
    teachingHours: program.teachingHours.flatMap((entry) => unitTeachingHour(entry, unit.id)),
  };
}

function unitTeachingHour(entry: HourRow, unitId: string): TeachingHourView[] {
  const activities = entry.activities.filter((activity) => activity.unitId === unitId);
  if (activities.length === 0) return [];
  return [
    {
      id: entry.id,
      sequence: entry.sequence,
      durationMinutes: entry.durationMinutes,
      unitMinutes: activities.reduce((total, activity) => total + activity.durationMinutes, 0),
      activities: activities.map((activity) => projectActivity(activity)),
    },
  ];
}

function projectActivity(activity: ActivityRow): ActivityView {
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
