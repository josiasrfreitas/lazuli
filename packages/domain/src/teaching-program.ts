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

/** Validate the imported graph before it becomes a catalog revision. */
export function assertTeachingProgram(input: TeachingProgramImport): void {
  const fail = (message: string): never => {
    throw new Error(message);
  };
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
  if (!input.teachingHours.length || !input.units.length || !input.lessons.length)
    fail("Programação incompleta.");
  if (
    !Number.isInteger(input.modality.weeklyMinutes) ||
    input.modality.weeklyMinutes < 60 ||
    input.modality.weeklyMinutes % 60 !== 0
  )
    fail("A carga semanal deve ser um número inteiro de horas-aula.");
  const units = new Map(input.units.map((unit) => [unit.key, unit]));
  const teachingHours = new Map(input.teachingHours.map((entry) => [entry.key, entry]));
  const lessons = new Set(input.lessons.map((lesson) => lesson.key));
  const assessments = new Map(input.assessments.map((assessment) => [assessment.key, assessment]));
  for (const assessment of input.assessments) {
    if (!units.has(assessment.unitKey)) fail("Prova sem unidade correspondente.");
  }
  let lastTeachingHour = 0;
  let lastUnit = 0;
  for (const activity of input.activities) {
    if (!Number.isInteger(activity.durationMinutes) || activity.durationMinutes <= 0)
      fail("Duração de atividade inválida.");
    const entry = teachingHours.get(activity.teachingHourKey);
    const unit = units.get(activity.unitKey);
    if (!entry || !unit) fail("Atividade sem hora-aula ou unidade correspondente.");
    if (entry!.sequence < lastTeachingHour || unit!.sequence < lastUnit)
      fail("Atividades fora da sequência de horas-aula e unidades.");
    lastTeachingHour = entry!.sequence;
    lastUnit = unit!.sequence;
    if (activity.lessons.some((lesson) => !lessons.has(lesson.key)))
      fail("Atividade referencia uma lição desconhecida.");
    if ((activity.kind === "LESSON") !== activity.lessons.length > 0)
      fail("Conteúdo de lição exige referências ao livro.");
    const assessment = activity.assessmentKey ? assessments.get(activity.assessmentKey) : undefined;
    if (activity.kind === "ASSESSMENT") {
      if (!assessment || assessment.unitKey !== activity.unitKey)
        fail("Atividade de prova exige uma prova da mesma unidade.");
    } else if (activity.assessmentKey)
      fail("Somente atividades de prova podem referenciar uma prova.");
  }
  for (const entry of input.teachingHours) {
    const duration = input.activities
      .filter((activity) => activity.teachingHourKey === entry.key)
      .reduce((total, activity) => total + activity.durationMinutes, 0);
    if (
      new Set(
        input.activities
          .filter((activity) => activity.teachingHourKey === entry.key)
          .map((activity) => activity.unitKey),
      ).size !== 1
    )
      fail("Uma hora-aula pertence a uma única unidade.");
    if (duration !== entry.durationMinutes || duration !== TEACHING_HOUR_MINUTES)
      fail("Cada hora-aula deve conter exatamente 60 minutos de atividades.");
  }
  for (const unit of input.units) {
    const activities = input.activities.filter((activity) => activity.unitKey === unit.key);
    if (!activities.length || activities.at(-1)?.kind !== "ASSESSMENT")
      fail("Cada unidade deve terminar com sua prova.");
    const firstAssessment = activities.findIndex((activity) => activity.kind === "ASSESSMENT");
    if (activities.slice(firstAssessment).some((activity) => activity.kind !== "ASSESSMENT"))
      fail("A prova encerra a unidade.");
    if (input.assessments.filter((assessment) => assessment.unitKey === unit.key).length !== 1)
      fail("Cada unidade tem uma prova de encerramento.");
  }
  for (const assessment of input.assessments) {
    if (!input.activities.some((activity) => activity.assessmentKey === assessment.key))
      fail("Prova sem atividade na programação.");
  }
}
