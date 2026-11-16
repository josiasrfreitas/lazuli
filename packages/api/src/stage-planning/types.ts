import type { ActivityContext } from "../teaching-programs/labels.js";
import type { z, stagePlanSnapshotSchema, ClassRecordContent } from "@lazuli/validators";
import type { PlanningScope } from "./data.js";

export type PlanSnapshot = z.infer<typeof stagePlanSnapshotSchema>;
export type PreviewItem = Omit<PlanSnapshot["items"][number], "plannedOn"> & {
  plannedOn: string | null;
  curriculum: ActivityContext | null;
};
export type PlanningRecord = {
  id: string;
  classId: string;
  date: string;
  time: string;
  content: ClassRecordContent;
};
export type PlanningDetail = {
  scope: PlanningScope;
  plan:
    | (Omit<PlanSnapshot, "items"> & {
        id: string;
        version: number;
        updatedAt: Date;
        items: (PlanSnapshot["items"][number] & { curriculum: ActivityContext | null })[];
      })
    | null;
  calendar: { availableMinutes: number; remainingSessions: number; unrecordedSessions: number };
  preview: { plannedStartOn: string; items: PreviewItem[] } | null;
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
