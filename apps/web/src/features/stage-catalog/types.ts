import type { RouterOutputs } from "@lazuli/api";
export type StageSummary = RouterOutputs["teachingPrograms"]["catalog"][number];
export type StageDetail = NonNullable<RouterOutputs["teachingPrograms"]["detail"]>;
export type TeachingProgram = StageDetail["programs"][number];
export type ProgramUnit = TeachingProgram["units"][number];
export type TeachingHour = ProgramUnit["teachingHours"][number];
export type ProgramActivity = TeachingHour["activities"][number];
