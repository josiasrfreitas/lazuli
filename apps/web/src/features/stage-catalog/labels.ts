import { TEACHING_HOUR_MINUTES } from "@lazuli/domain";
import type { StageDetail, TeachingProgram } from "./types";

export function stageContext(stage: StageDetail, program?: TeachingProgram): string {
  const context = stage.track.name + " · " + stage.name;
  return program ? context + " · " + programLabel(program, stage.programs) : context;
}
export function formatWeeklyHours(program: TeachingProgram): string {
  return (program.modality.weeklyMinutes / TEACHING_HOUR_MINUTES).toLocaleString("pt-BR");
}
export function programLabel(program: TeachingProgram, programs: TeachingProgram[]): string {
  const label = program.scheduleType === "REGULAR" ? "Regular" : "PPT";
  const needsLoad = programs.some(
    (other) => other.id !== program.id && other.scheduleType === program.scheduleType,
  );
  return needsLoad ? label + " · " + formatWeeklyHours(program) + " h/sem." : label;
}

export function compactPages(pages: number[]): string {
  const runs: { start: number; end: number }[] = [];
  for (const number of pages) {
    const last = runs.at(-1);
    if (last && last.end + 1 === number) last.end = number;
    else runs.push({ start: number, end: number });
  }
  return pages.length > 0
    ? (pages.length === 1 ? "Pág. " : "Págs. ") +
        runs.map(({ start, end }) => (start === end ? String(start) : start + "–" + end)).join(", ")
    : "";
}
