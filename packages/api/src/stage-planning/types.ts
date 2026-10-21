import type { z, stagePlanSnapshotSchema, ClassRecordContent } from "@lazuli/validators";
import type { PlanningScope } from "./data.js";

export type PlanSnapshot = z.infer<typeof stagePlanSnapshotSchema>;
export type PlanningRecord = {
  id: string;
  classId: string;
  date: string;
  time: string;
  content: ClassRecordContent;
};
export type PlanningDetail = {
  scope: PlanningScope;
  plan: (PlanSnapshot & { id: string; version: number; updatedAt: Date }) | null;
  records: PlanningRecord[];
  upcoming: { id: string; date: string; time: string }[];
};
export type PlanningRevision = {
  id: string;
  version: number;
  reason: string;
  createdAt: Date;
  recordedBy: string;
  snapshot: PlanSnapshot;
};
export type PlanningClassContext = {
  id: string;
  name: string;
  scheduleType: "REGULAR" | "PERSONALIZED";
  semester: string;
  students: {
    progressId: string;
    studentId: string;
    name: string;
    stage: string;
    startOn: string;
    historical: boolean;
  }[];
};
