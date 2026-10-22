/** Catalog age group is a pedagogical classification; teens belong to ADULT. */
export type TrackAgeGroup = "ADULT" | "CHILD";
export const TEACHING_HOUR_MINUTES = 60;
export const DEFAULT_TEACHING_MODALITY = {
  code: "WEEKLY_2H",
  name: "2 horas por semana",
  weeklyMinutes: 120,
} as const;

export type ProgramActivityKind =
  | "LESSON"
  | "INTRODUCTION"
  | "REVIEW"
  | "ASSESSMENT"
  | "VIDEO"
  | "ACTIVITY";

export type TeachingProgramImport = {
  stageId: string;
  source: { provider: string; reference: string; revision: string };
  scheduleType: "REGULAR" | "PERSONALIZED";
  modality: { code: string; name: string; weeklyMinutes: number };
  lessons: { key: string; sequence: number; title: string }[];
  units: { key: string; sequence: number; title: string }[];
  teachingHours: { key: string; sequence: number; durationMinutes: number }[];
  assessments: { key: string; unitKey: string; sequence: number; title: string }[];
  activities: {
    key: string;
    unitKey: string;
    teachingHourKey: string;
    sequence: number;
    durationMinutes: number;
    kind: ProgramActivityKind;
    title: string;
    sourceCode: string | null;
    descriptionPending: boolean;
    assessmentKey: string | null;
    lessons: { key: string; part: string | null }[];
  }[];
};

type ProgramReferences = {
  units: Map<string, TeachingProgramImport["units"][number]>;
  teachingHours: Map<string, TeachingProgramImport["teachingHours"][number]>;
  lessons: Set<string>;
  assessments: Map<string, TeachingProgramImport["assessments"][number]>;
};
type Activity = TeachingProgramImport["activities"][number];

/** Validate the imported graph before it becomes a catalog revision. */
export function assertTeachingProgram(input: TeachingProgramImport): void {
  assertProgramShape(input);
  const references = programReferences(input);
  for (const assessment of input.assessments)
    if (!references.units.has(assessment.unitKey)) fail("Prova sem unidade correspondente.");
  assertActivities(input, references);
  assertTeachingHours(input);
  assertUnits(input);
  for (const assessment of input.assessments)
    if (!input.activities.some((activity) => activity.assessmentKey === assessment.key))
      fail("Prova sem atividade na programação.");
}

function fail(message: string): never {
  throw new Error(message);
}
function assertProgramShape(input: TeachingProgramImport): void {
  for (const [name, rows] of [
    ["lições", input.lessons],
    ["unidades", input.units],
    ["horas-aula", input.teachingHours],
    ["provas", input.assessments],
    ["atividades", input.activities],
  ] as const) {
    if (new Set(rows.map((row) => row.key)).size !== rows.length)
      fail(`Identificadores repetidos em ${name}.`);
    if (rows.some((row, index) => row.sequence !== index + 1))
      fail(`Sequência inválida em ${name}.`);
  }
  if (input.teachingHours.length === 0 || input.units.length === 0 || input.lessons.length === 0)
    fail("Programação incompleta.");
  assertWeeklyMinutes(input.modality.weeklyMinutes);
}
function assertWeeklyMinutes(minutes: number): void {
  if (
    !Number.isInteger(minutes) ||
    minutes < TEACHING_HOUR_MINUTES ||
    minutes % TEACHING_HOUR_MINUTES !== 0
  )
    fail("A carga semanal deve ser um número inteiro de horas-aula.");
}
function programReferences(input: TeachingProgramImport): ProgramReferences {
  return {
    units: new Map(input.units.map((unit) => [unit.key, unit])),
    teachingHours: new Map(input.teachingHours.map((entry) => [entry.key, entry])),
    lessons: new Set(input.lessons.map((lesson) => lesson.key)),
    assessments: new Map(input.assessments.map((assessment) => [assessment.key, assessment])),
  };
}
function assertActivities(input: TeachingProgramImport, references: ProgramReferences): void {
  let lastTeachingHour = 0;
  let lastUnit = 0;
  for (const activity of input.activities) {
    if (!Number.isInteger(activity.durationMinutes) || activity.durationMinutes <= 0)
      fail("Duração de atividade inválida.");
    const entry = references.teachingHours.get(activity.teachingHourKey);
    const unit = references.units.get(activity.unitKey);
    if (!entry || !unit) fail("Atividade sem hora-aula ou unidade correspondente.");
    if (entry.sequence < lastTeachingHour || unit.sequence < lastUnit)
      fail("Atividades fora da sequência de horas-aula e unidades.");
    lastTeachingHour = entry.sequence;
    lastUnit = unit.sequence;
    assertActivityReferences(activity, references);
  }
}
function assertActivityReferences(activity: Activity, references: ProgramReferences): void {
  if (activity.lessons.some((lesson) => !references.lessons.has(lesson.key)))
    fail("Atividade referencia uma lição desconhecida.");
  if ((activity.kind === "LESSON") !== activity.lessons.length > 0)
    fail("Conteúdo de lição exige referências ao livro.");
  const assessment = activity.assessmentKey
    ? references.assessments.get(activity.assessmentKey)
    : undefined;
  if (activity.kind === "ASSESSMENT") {
    if (!assessment || assessment.unitKey !== activity.unitKey)
      fail("Atividade de prova exige uma prova da mesma unidade.");
  } else if (activity.assessmentKey)
    fail("Somente atividades de prova podem referenciar uma prova.");
}
function assertTeachingHours(input: TeachingProgramImport): void {
  for (const entry of input.teachingHours) {
    const activities = input.activities.filter(
      (activity) => activity.teachingHourKey === entry.key,
    );
    const duration = activities.reduce((total, activity) => total + activity.durationMinutes, 0);
    if (new Set(activities.map((activity) => activity.unitKey)).size !== 1)
      fail("Uma hora-aula pertence a uma única unidade.");
    if (duration !== entry.durationMinutes || duration !== TEACHING_HOUR_MINUTES)
      fail("Cada hora-aula deve conter exatamente 60 minutos de atividades.");
  }
}
function assertUnits(input: TeachingProgramImport): void {
  for (const unit of input.units) {
    const activities = input.activities.filter((activity) => activity.unitKey === unit.key);
    if (activities.length === 0 || activities.at(-1)?.kind !== "ASSESSMENT")
      fail("Cada unidade deve terminar com sua prova.");
    const firstAssessment = activities.findIndex((activity) => activity.kind === "ASSESSMENT");
    if (activities.slice(firstAssessment).some((activity) => activity.kind !== "ASSESSMENT"))
      fail("A prova encerra a unidade.");
    if (input.assessments.filter((assessment) => assessment.unitKey === unit.key).length !== 1)
      fail("Cada unidade tem uma prova de encerramento.");
  }
}
