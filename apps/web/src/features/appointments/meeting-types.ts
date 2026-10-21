import type { ReactNode } from "react";
import type { CalendarEvent, CalendarInterval, SearchSelectOption } from "@lazuli/ui";
export type ScheduleSelection = CalendarInterval & {
  sessionId?: string | undefined;
  format?: "IN_PERSON" | "ONLINE" | undefined;
};
export type MeetingEvent = CalendarEvent & {
  sessionId?: string | undefined;
  format?: "IN_PERSON" | "ONLINE";
};
export type MeetingProps = {
  actions?: ReactNode;
  durationMinutes?: number;
  kind: "CLASS" | "INDEPENDENT";
  studentId: string;
  previousId?: string | undefined;
  teacher: SearchSelectOption | null;
  onTeacherChange: (value: SearchSelectOption | null) => void;
  date: string;
  startTime: string;
  endTime: string;
  format: "IN_PERSON" | "ONLINE";
  sessionId: string;
  onDateChange: (date: string) => void;
  onSelect: (value: ScheduleSelection) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onFormatChange: (value: "IN_PERSON" | "ONLINE") => void;
  onReadyChange: (ready: boolean) => void;
  error?: string | undefined;
};
