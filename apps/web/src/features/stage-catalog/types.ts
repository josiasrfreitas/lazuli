import type { RouterOutputs } from "@lazuli/api";
export type StageDetail = NonNullable<RouterOutputs["teachingPrograms"]["detail"]>;
export type TeachingProgram = StageDetail["programs"][number];
export type ProgramUnit = TeachingProgram["units"][number];
export type TeachingHour = ProgramUnit["teachingHours"][number];
export type ProgramActivity = TeachingHour["activities"][number];
export type Directory = RouterOutputs["teachingPrograms"]["directory"];
export type Track = Directory["tracks"][number];
export type Stage = Track["stages"][number];
