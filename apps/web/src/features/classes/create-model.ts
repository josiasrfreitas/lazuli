export type ClassDraft = {
  scheduleType: "REGULAR" | "PERSONALIZED";
  format: "IN_PERSON" | "ONLINE";
  teacherId: string;
  semesterId: string;
  sharedStageId: string;
  slots: Array<{
    weekday:
      | ""
      | "MONDAY"
      | "TUESDAY"
      | "WEDNESDAY"
      | "THURSDAY"
      | "FRIDAY"
      | "SATURDAY"
      | "SUNDAY";
    startTime: string;
    endTime: string;
  }>;
};

export type ClassOptions = {
  teachers: { id: string; name: string }[];
  semesters: { id: string; name: string }[];
  stages: { id: string; name: string; internalCode: string }[];
};

export const initialClassDraft: ClassDraft = {
  scheduleType: "REGULAR",
  format: "IN_PERSON",
  teacherId: "",
  semesterId: "",
  sharedStageId: "",
  slots: [emptyClassSlot(), emptyClassSlot()],
};

export function emptyClassSlot(): ClassDraft["slots"][number] {
  return { weekday: "", startTime: "", endTime: "" };
}
