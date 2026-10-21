import type { ProgramActivityKind } from "@lazuli/domain";

type Identity = { id: string; sequence: number; title: string };
type Track = { id: string; name: string; ageGroup: "ADULT" | "CHILD"; status: "ACTIVE" | "LEGACY" };
export type StageSummary = {
  id: string;
  name: string;
  internalCode: string;
  bookLessonCount: number | null;
  track: Track;
  _count: { teachingPrograms: number };
};
export type ActivityDetail = {
  id: string;
  kind: ProgramActivityKind;
  title: string;
  durationMinutes: number;
  sourceCode: string | null;
  descriptionPending: boolean;
  assessment: Identity | null;
  lessons: (Identity & { part: string | null })[];
};
export type ProgramDetail = {
  id: string;
  scheduleType: "REGULAR" | "PERSONALIZED";
  modality: { id: string; name: string; weeklyMinutes: number };
  source: { provider: string; reference: string; revision: string };
  teachingHourCount: number;
  totalMinutes: number;
  unitCount: number;
  assessmentCount: number;
  unresolvedActivityCount: number;
  units: (Identity & {
    teachingHours: {
      id: string;
      sequence: number;
      durationMinutes: number;
      unitMinutes: number;
      activities: ActivityDetail[];
    }[];
  })[];
};
export type StageProgramDetail = Omit<StageSummary, "bookLessonCount" | "_count"> & {
  lessonCount: number | null;
  lessons: Identity[];
  programs: ProgramDetail[];
};
