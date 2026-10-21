import type { DatabaseClient } from "../../packages/db/src/client.js";
import {
  DEFAULT_TEACHING_MODALITY,
  TEACHING_HOUR_MINUTES,
  type TeachingProgramImport,
  type ProgramActivityKind,
} from "../../packages/domain/src/teaching-program.js";
import { importTeachingProgram } from "../../packages/api/src/teaching-programs/import.js";
import { sourcePrograms } from "./teaching-program-source.js";

const REGULAR_HOURS = 40;
const PERSONALIZED_HOURS = 50;
const PROGRAM_HOURS = [REGULAR_HOURS, PERSONALIZED_HOURS] as const;
type ProgramHours = (typeof PROGRAM_HOURS)[number];
type Transcription = {
  stageId: string;
  sourceCode: string;
  total: ProgramHours;
  entries: readonly string[];
};
type SourceLessons = TeachingProgramImport["activities"][number]["lessons"];

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

function emptyProgram({ stageId, sourceCode, total }: Transcription): TeachingProgramImport {
  return {
    stageId,
    source: {
      provider: "supplied-pdf",
      reference: `PROGRAMACAO ${total}H · ${sourceCode} · página 1`,
      revision: "transcription-2026-10-19",
    },
    scheduleType: total === REGULAR_HOURS ? "REGULAR" : "PERSONALIZED",
    modality: DEFAULT_TEACHING_MODALITY,
    lessons: Array.from({ length: 10 }, (_unused, index) => ({
      key: String(index + 1),
      sequence: index + 1,
      title: `Lição ${index + 1}`,
    })),
    units: [],
    teachingHours: [],
    assessments: [],
    activities: [],
  };
}

function sourceLessons(raw: string): SourceLessons {
  return raw.split("/").map((part) => {
    const match = /^(\d+)([AB])?$/u.exec(part)!;
    return { key: match[1]!, part: match[2] ?? null };
  });
}

function activityTitle(
  kind: ProgramActivityKind,
  { lessons, unit }: { lessons: SourceLessons; unit: number },
): string {
  if (kind === "LESSON")
    return lessons
      .map((lesson) => `Lição ${lesson.key}${lesson.part ? ` · parte ${lesson.part}` : ""}`)
      .join(" / ");
  return {
    ASSESSMENT: `Prova da unidade ${unit}`,
    REVIEW: "Revisão",
    INTRODUCTION: "Introdução",
    VIDEO: "Vídeo",
    ACTIVITY: "Atividade da programação",
  }[kind];
}

type SourceActivity = {
  index: number;
  raw: string;
  kind: ProgramActivityKind;
  unit: number;
  assessmentKey: string | null;
};
function appendActivity(input: TeachingProgramImport, source: SourceActivity): void {
  const { index, raw, kind, unit, assessmentKey } = source;
  const lessons = kind === "LESSON" ? sourceLessons(raw) : [];
  const teachingHourKey = `teaching-hour-${index + 1}`;
  input.teachingHours.push({
    key: teachingHourKey,
    sequence: index + 1,
    durationMinutes: TEACHING_HOUR_MINUTES,
  });
  input.activities.push({
    key: `activity-${index + 1}`,
    unitKey: `unit-${unit}`,
    teachingHourKey,
    sequence: index + 1,
    durationMinutes: TEACHING_HOUR_MINUTES,
    kind,
    title: activityTitle(kind, { lessons, unit }),
    sourceCode: raw,
    descriptionPending: kind === "ACTIVITY",
    assessmentKey: kind === "ASSESSMENT" ? assessmentKey : null,
    lessons,
  });
}

/** Adapt only the supplied PDF transcription; unexplained source codes stay explicitly unresolved. */
function fromTranscription(source: Transcription): TeachingProgramImport {
  const input = emptyProgram(source);
  const { entries } = source;
  let unit = 1;
  let assessmentKey: string | null = null;
  for (const [index, raw] of entries.entries()) {
    const kind = sourceKind(raw);
    const previousKind = index ? sourceKind(entries[index - 1]!) : null;
    if (previousKind === "ASSESSMENT" && kind !== "ASSESSMENT") unit += 1;
    const unitKey = `unit-${unit}`;
    if (!input.units.some((entry) => entry.key === unitKey))
      input.units.push({ key: unitKey, sequence: unit, title: `Unidade ${unit}` });
    if (kind === "ASSESSMENT" && previousKind !== "ASSESSMENT") {
      assessmentKey = `assessment-${unit}`;
      input.assessments.push({
        key: assessmentKey,
        unitKey,
        sequence: input.assessments.length + 1,
        title: `Prova da unidade ${unit}`,
      });
    }
    appendActivity(input, { index, raw, kind, unit, assessmentKey });
  }
  return input;
}

/** Development data only. This does not fetch or claim to synchronize with the external provider. */
export async function seedTeachingPrograms(database: DatabaseClient): Promise<void> {
  for (const [internalCode, sourceCode, family] of sources) {
    const stage = await database.stage.findFirst({
      where: { internalCode, track: { name: "Adultos / English Main" } },
      select: { id: true },
    });
    if (!stage) continue;
    for (const total of PROGRAM_HOURS) {
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
