import type { DatabaseClient } from "../../packages/db/src/client.js";
import {
  DEFAULT_TEACHING_MODALITY,
  TEACHING_HOUR_MINUTES,
  type TeachingProgramImport,
  type ProgramActivityKind,
} from "../../packages/domain/src/teaching-program.js";
import { importTeachingProgram } from "../../packages/api/src/teaching-programs/import.js";
import { sourcePrograms } from "./teaching-program-source.js";

const sources = [
  ["E1", "ESS1", "essentials"],
  ["E2", "ESS2", "essentials"],
  ["T1", "TRS1", "transitions"],
  ["T2", "TRS2", "transitions"],
  ["F1", "FLU1", "fluency"],
  ["F2", "FLU2", "fluency"],
  ["FIF", "IFC", "focus"],
] as const;

function sourceKind(raw: string): ProgramActivityKind {
  if (raw === "TEST" || /^MT\d+$/u.test(raw)) return "ASSESSMENT";
  if (raw === "REVIEW") return "REVIEW";
  if (raw === "INTRO") return "INTRODUCTION";
  if (raw === "VIDEO") return "VIDEO";
  if (raw.split("/").every((part) => /^\d+[AB]?$/u.test(part))) return "LESSON";
  return "ACTIVITY";
}

const REGULAR_TEACHING_HOURS = 40;
const PPT_TEACHING_HOURS = 50;
const BOOK_LESSON_COUNT = 10;
type Transcription = {
  stageId: string;
  sourceCode: string;
  total: typeof REGULAR_TEACHING_HOURS | typeof PPT_TEACHING_HOURS;
  entries: readonly string[];
};
type SourceState = {
  unit: number;
  assessmentKey: string | null;
  previousKind: ProgramActivityKind | null;
};

function bookReferences(
  raw: string,
  kind: ProgramActivityKind,
): TeachingProgramImport["activities"][number]["lessons"] {
  if (kind !== "LESSON") return [];
  return raw.split("/").map((part) => {
    const match = /^(\d+)([AB])?$/u.exec(part)!;
    return { key: match[1]!, part: match[2] ?? null };
  });
}

function activityTitle(
  kind: ProgramActivityKind,
  {
    unit,
    lessons,
  }: { unit: number; lessons: TeachingProgramImport["activities"][number]["lessons"] },
): string {
  if (kind === "LESSON")
    return lessons
      .map((lesson) => `Lição ${lesson.key}${lesson.part ? ` · parte ${lesson.part}` : ""}`)
      .join(" / ");
  if (kind === "ASSESSMENT") return `Prova da unidade ${unit}`;
  if (kind === "REVIEW") return "Revisão";
  if (kind === "INTRODUCTION") return "Introdução";
  if (kind === "VIDEO") return "Vídeo";
  return "Atividade da programação";
}

function appendUnit(
  program: TeachingProgramImport,
  { kind, state }: { kind: ProgramActivityKind; state: SourceState },
): void {
  if (state.previousKind === "ASSESSMENT" && kind !== "ASSESSMENT") state.unit += 1;
  const unitKey = `unit-${state.unit}`;
  if (!program.units.some((entry) => entry.key === unitKey))
    program.units.push({ key: unitKey, sequence: state.unit, title: `Unidade ${state.unit}` });
  if (kind === "ASSESSMENT" && state.previousKind !== "ASSESSMENT") {
    state.assessmentKey = `assessment-${state.unit}`;
    program.assessments.push({
      key: state.assessmentKey,
      unitKey,
      sequence: program.assessments.length + 1,
      title: `Prova da unidade ${state.unit}`,
    });
  }
}

function appendHour(
  program: TeachingProgramImport,
  { raw, index, state }: { raw: string; index: number; state: SourceState },
): void {
  const kind = sourceKind(raw);
  appendUnit(program, { kind, state });
  const lessons = bookReferences(raw, kind);
  const teachingHourKey = `teaching-hour-${index + 1}`;
  program.teachingHours.push({
    key: teachingHourKey,
    sequence: index + 1,
    durationMinutes: TEACHING_HOUR_MINUTES,
  });
  program.activities.push({
    key: `activity-${index + 1}`,
    unitKey: `unit-${state.unit}`,
    teachingHourKey,
    sequence: index + 1,
    durationMinutes: TEACHING_HOUR_MINUTES,
    kind,
    title: activityTitle(kind, { unit: state.unit, lessons }),
    sourceCode: raw,
    descriptionPending: kind === "ACTIVITY",
    assessmentKey: kind === "ASSESSMENT" ? state.assessmentKey : null,
    lessons,
  });
  state.previousKind = kind;
}

/** Adapt only the supplied transcription, preserving unexplained source codes. */
function fromTranscription({
  stageId,
  sourceCode,
  total,
  entries,
}: Transcription): TeachingProgramImport {
  const program: TeachingProgramImport = {
    stageId,
    source: {
      provider: "supplied-pdf",
      reference: `PROGRAMACAO ${total}H · ${sourceCode} · página 1`,
      revision: "transcription-2026-10-19",
    },
    scheduleType: total === REGULAR_TEACHING_HOURS ? "REGULAR" : "PERSONALIZED",
    modality: DEFAULT_TEACHING_MODALITY,
    lessons: Array.from({ length: BOOK_LESSON_COUNT }, (_entry, index) => ({
      key: String(index + 1),
      sequence: index + 1,
      title: `Lição ${index + 1}`,
    })),
    units: [],
    teachingHours: [],
    assessments: [],
    activities: [],
  };
  const state: SourceState = { unit: 1, assessmentKey: null, previousKind: null };
  for (const [index, raw] of entries.entries()) appendHour(program, { raw, index, state });
  return program;
}

/** Development data only. This does not fetch or claim to synchronize with the external provider. */
export async function seedTeachingPrograms(database: DatabaseClient): Promise<void> {
  for (const [internalCode, sourceCode, family] of sources) {
    const stage = await database.stage.findFirst({
      where: { internalCode, track: { name: "Adultos / English Main" } },
      select: { id: true },
    });
    if (!stage) continue;
    for (const total of [REGULAR_TEACHING_HOURS, PPT_TEACHING_HOURS] as const) {
      await importTeachingProgram(
        database,
        fromTranscription({
          stageId: stage.id,
          sourceCode,
          total,
          entries: sourcePrograms[family][total],
        }),
      );
    }
  }
}
