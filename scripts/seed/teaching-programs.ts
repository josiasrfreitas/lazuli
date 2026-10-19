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

/** Adapt only the supplied PDF transcription; unexplained source codes stay explicitly unresolved. */
function fromTranscription(
  stageId: string,
  sourceCode: string,
  total: 40 | 50,
  entries: readonly string[],
): TeachingProgramImport {
  const input: TeachingProgramImport = {
    stageId,
    source: {
      provider: "supplied-pdf",
      reference: `PROGRAMACAO ${total}H · ${sourceCode} · página 1`,
      revision: "transcription-2026-10-19",
    },
    scheduleType: total === 40 ? "REGULAR" : "PERSONALIZED",
    modality: DEFAULT_TEACHING_MODALITY,
    lessons: Array.from({ length: 10 }, (_, index) => ({
      key: String(index + 1),
      sequence: index + 1,
      title: `Lição ${index + 1}`,
    })),
    units: [],
    teachingHours: [],
    assessments: [],
    activities: [],
  };
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
    const lessons =
      kind === "LESSON"
        ? raw.split("/").map((part) => {
            const match = /^(\d+)([AB])?$/u.exec(part)!;
            return { key: match[1]!, part: match[2] ?? null };
          })
        : [];
    const title =
      kind === "LESSON"
        ? lessons
            .map((lesson) => `Lição ${lesson.key}${lesson.part ? ` · parte ${lesson.part}` : ""}`)
            .join(" / ")
        : kind === "ASSESSMENT"
          ? `Prova da unidade ${unit}`
          : kind === "REVIEW"
            ? "Revisão"
            : kind === "INTRODUCTION"
              ? "Introdução"
              : kind === "VIDEO"
                ? "Vídeo"
                : "Atividade da programação";
    const teachingHourKey = `teaching-hour-${index + 1}`;
    input.teachingHours.push({
      key: teachingHourKey,
      sequence: index + 1,
      durationMinutes: TEACHING_HOUR_MINUTES,
    });
    input.activities.push({
      key: `activity-${index + 1}`,
      unitKey,
      teachingHourKey,
      sequence: index + 1,
      durationMinutes: TEACHING_HOUR_MINUTES,
      kind,
      title,
      sourceCode: raw,
      descriptionPending: kind === "ACTIVITY",
      assessmentKey: kind === "ASSESSMENT" ? assessmentKey : null,
      lessons,
    });
  }
  return input;
}

/** Development data only. This does not fetch or claim to synchronize with the external provider. */
export async function seedTeachingPrograms(database: DatabaseClient) {
  for (const [internalCode, sourceCode, family] of sources) {
    const stage = await database.stage.findFirst({
      where: { internalCode, track: { name: "Adultos / English Main" } },
      select: { id: true },
    });
    if (!stage) continue;
    for (const total of [40, 50] as const) {
      await importTeachingProgram(
        database,
        fromTranscription(stage.id, sourceCode, total, sourcePrograms[family][total]),
      );
    }
  }
}
