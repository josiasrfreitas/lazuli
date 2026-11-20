import { programActivityLabels } from "@lazuli/domain";
import type { Prisma } from "@lazuli/db";
import { bookLessonSelect } from "./book-content.js";

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
            orderBy: [
              { lesson: { sequence: "asc" } },
              { part: "asc" },
              { bookPart: { sequence: "asc" } },
              { bookPage: { number: "asc" } },
              { pageActivity: { sequence: "asc" } },
            ],
            include: {
              lesson: true,
              bookPart: { select: { id: true, title: true } },
              bookPage: { select: { id: true, number: true } },
              pageActivity: { select: { id: true, title: true } },
            },
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
  bookLessons: {
    where: { deletedAt: null },
    orderBy: { sequence: "asc" },
    select: bookLessonSelect,
  },
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
  | "id"
  | "kind"
  | "title"
  | "durationMinutes"
  | "sourceCode"
  | "instructions"
  | "descriptionPending"
  | "pageStart"
  | "pageEnd"
> & {
  bookTitle: string;
  assessment: Pick<NonNullable<ActivityRow["assessment"]>, "id" | "sequence" | "title"> | null;
  lessons: (Pick<LessonLink["lesson"], "id" | "sequence" | "title"> &
    Pick<LessonLink, "bookPart" | "bookPage" | "pageActivity"> & {
      part: string | null;
    })[];
};
type TeachingHourView = Pick<HourRow, "id" | "sequence" | "durationMinutes"> & {
  lastChange: string;
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
type StageProgramView = Pick<StageRow, "id" | "name" | "internalCode" | "track" | "status"> & {
  lessonCount: StageRow["bookLessonCount"];
  lessons: StageRow["bookLessons"];
  programs: ProgramView[];
};

export async function readStageCatalog(database: Database): Promise<CatalogRow[]> {
  return database.stage.findMany({
    where: { deletedAt: null, track: { deletedAt: null, productLine: { deletedAt: null } } },
    orderBy: [{ track: { displayOrder: "asc" } }, { sequence: "asc" }],
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
    status: stage.status,
    track: stage.track,
    lessonCount: stage.bookLessonCount,
    lessons: stage.bookLessons,
    programs: stage.teachingPrograms.map((program) => projectProgram(program)),
  };
}

function projectProgram(program: ProgramRow): ProgramView {
  const labels = programActivityLabels(program.teachingHours.flatMap((hour) => hour.activities));
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
    units: program.units.map((unit) => projectUnit(unit, { program, labels })),
  };
}

function projectUnit(
  unit: UnitRow,
  { program, labels }: { program: ProgramRow; labels: Map<string, string> },
): UnitView {
  return {
    id: unit.id,
    sequence: unit.sequence,
    title: unit.title,
    teachingHours: program.teachingHours.flatMap((entry) =>
      unitTeachingHour(entry, { unitId: unit.id, labels }),
    ),
  };
}

function unitTeachingHour(
  entry: HourRow,
  { unitId, labels }: { unitId: string; labels: Map<string, string> },
): TeachingHourView[] {
  const activities = entry.activities.filter((activity) => activity.unitId === unitId);
  if (activities.length === 0) return [];
  return [
    {
      id: entry.id,
      sequence: entry.sequence,
      durationMinutes: entry.durationMinutes,
      lastChange: entry.updatedAt.toISOString(),
      unitMinutes: activities.reduce((total, activity) => total + activity.durationMinutes, 0),
      activities: activities.map((activity) => projectActivity(activity, labels)),
    },
  ];
}

function projectActivity(activity: ActivityRow, labels: Map<string, string>): ActivityView {
  return {
    id: activity.id,
    kind: activity.kind,
    title: labels.get(activity.id) ?? activity.title,
    bookTitle: activity.title,
    pageStart: activity.pageStart,
    pageEnd: activity.pageEnd,
    durationMinutes: activity.durationMinutes,
    sourceCode: activity.sourceCode,
    instructions: activity.instructions,
    descriptionPending: activity.descriptionPending,
    assessment: activity.assessment
      ? {
          id: activity.assessment.id,
          sequence: activity.assessment.sequence,
          title: activity.assessment.title,
        }
      : null,
    lessons: activity.lessons.map(({ part, lesson, bookPart, bookPage, pageActivity }) => ({
      id: lesson.id,
      sequence: lesson.sequence,
      title: lesson.title,
      part: part || null,
      bookPart,
      bookPage,
      pageActivity,
    })),
  };
}
