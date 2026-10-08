export type ClassDraft = {
  internalCode: string;
  scheduleType: "REGULAR" | "PERSONALIZED";
  format: "IN_PERSON" | "ONLINE";
  teacherId: string;
  semesterId: string;
  sharedStageId: string;
  portalClassName: string;
  year: string;
  capacity: string;
  slots: Array<{
    weekday: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
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
  internalCode: "",
  scheduleType: "REGULAR",
  format: "IN_PERSON",
  teacherId: "",
  semesterId: "",
  sharedStageId: "",
  portalClassName: "",
  year: String(new Date().getFullYear()),
  capacity: "20",
  slots: [{ weekday: "MONDAY", startTime: "14:00", endTime: "15:00" }],
};
