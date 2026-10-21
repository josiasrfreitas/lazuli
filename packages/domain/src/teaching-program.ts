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

type Activity = TeachingProgramImport["activities"][number];

function assertOrdered(input: TeachingProgramImport): void {
  for (const [name, rows] of [
    ["lições", input.lessons],
    ["unidades", input.units],
    ["horas-aula", input.teachingHours],
    ["provas", input.assessments],
    ["atividades", input.activities],
  ] as const) {
    if (new Set(rows.map((row) => row.key)).size !== rows.length)
      throw new Error(`Identificadores repetidos em ${name}.`);
    if (rows.some((row, index) => row.sequence !== index + 1))
      throw new Error(`Sequência inválida em ${name}.`);
  }
}

function assertActivityReferences(input: TeachingProgramImport, activity: Activity): void {
  if (!Number.isInteger(activity.durationMinutes) || activity.durationMinutes <= 0)
    throw new Error("Duração de atividade inválida.");
  if (activity.lessons.some((lesson) => !input.lessons.some((row) => row.key === lesson.key)))
    throw new Error("Atividade referencia uma lição desconhecida.");
  if ((activity.kind === "LESSON") !== activity.lessons.length > 0)
    throw new Error("Conteúdo de lição exige referências ao livro.");
  const assessment = input.assessments.find((row) => row.key === activity.assessmentKey);
  if (activity.kind === "ASSESSMENT") {
    if (!assessment || assessment.unitKey !== activity.unitKey)
      throw new Error("Atividade de prova exige uma prova da mesma unidade.");
  } else if (activity.assessmentKey)
    throw new Error("Somente atividades de prova podem referenciar uma prova.");
}

function assertActivities(input: TeachingProgramImport): void {
  let lastTeachingHour = 0;
  let lastUnit = 0;
  for (const activity of input.activities) {
    const entry = input.teachingHours.find((row) => row.key === activity.teachingHourKey);
    const unit = input.units.find((row) => row.key === activity.unitKey);
    if (!entry || !unit) throw new Error("Atividade sem hora-aula ou unidade correspondente.");
    if (entry.sequence < lastTeachingHour || unit.sequence < lastUnit)
      throw new Error("Atividades fora da sequência de horas-aula e unidades.");
    lastTeachingHour = entry.sequence;
    lastUnit = unit.sequence;
    assertActivityReferences(input, activity);
  }
}

function assertTeachingHours(input: TeachingProgramImport): void {
  for (const entry of input.teachingHours) {
    const activities = input.activities.filter((row) => row.teachingHourKey === entry.key);
    if (new Set(activities.map((row) => row.unitKey)).size !== 1)
      throw new Error("Uma hora-aula pertence a uma única unidade.");
    const duration = activities.reduce((total, row) => total + row.durationMinutes, 0);
    if (duration !== entry.durationMinutes || duration !== TEACHING_HOUR_MINUTES)
      throw new Error("Cada hora-aula deve conter exatamente 60 minutos de atividades.");
  }
}

function assertUnitAssessments(input: TeachingProgramImport): void {
  for (const unit of input.units) {
    const activities = input.activities.filter((row) => row.unitKey === unit.key);
    if (activities.length === 0 || activities.at(-1)?.kind !== "ASSESSMENT")
      throw new Error("Cada unidade deve terminar com sua prova.");
    const firstAssessment = activities.findIndex((row) => row.kind === "ASSESSMENT");
    if (activities.slice(firstAssessment).some((row) => row.kind !== "ASSESSMENT"))
      throw new Error("A prova encerra a unidade.");
    if (input.assessments.filter((row) => row.unitKey === unit.key).length !== 1)
      throw new Error("Cada unidade tem uma prova de encerramento.");
  }
  for (const assessment of input.assessments) {
    if (!input.activities.some((row) => row.assessmentKey === assessment.key))
      throw new Error("Prova sem atividade na programação.");
  }
}

/** Validate the imported graph before it becomes a catalog revision. */
export function assertTeachingProgram(input: TeachingProgramImport): void {
  assertOrdered(input);
  if (input.teachingHours.length === 0 || input.units.length === 0 || input.lessons.length === 0)
    throw new Error("Programação incompleta.");
  if (
    !Number.isInteger(input.modality.weeklyMinutes) ||
    input.modality.weeklyMinutes < TEACHING_HOUR_MINUTES ||
    input.modality.weeklyMinutes % TEACHING_HOUR_MINUTES !== 0
  )
    throw new Error("A carga semanal deve ser um número inteiro de horas-aula.");
  for (const assessment of input.assessments) {
    if (!input.units.some((unit) => unit.key === assessment.unitKey))
      throw new Error("Prova sem unidade correspondente.");
  }
  assertActivities(input);
  assertTeachingHours(input);
  assertUnitAssessments(input);
}
