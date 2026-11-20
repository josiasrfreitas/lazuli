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
