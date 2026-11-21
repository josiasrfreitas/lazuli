import { isAdministrativeRole } from "@lazuli/auth/roles";
import { useCalendarSelection, type CalendarSelection } from "./use-calendar-selection";
import { useState } from "react";
import type { SearchSelectOption } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { CalendarLesson } from "./calendar-model";
import { filterLessons, filtersRestricted } from "./calendar-filter";
import { EVENT_LABELS } from "./lesson-presentation";

type LessonCalendarModel = CalendarSelection & {
  admin: boolean;
  types: string[];
  setTypes: (types: string[]) => void;
  teacherSearch: string;
  setTeacherSearch: (search: string) => void;
  teachers: SearchSelectOption[];
  setTeachers: (teachers: SearchSelectOption[]) => void;
  formats: string[];
  setFormats: (formats: string[]) => void;
  filtered: CalendarLesson[];
  restricted: boolean;
  resetFilters: () => void;
};

export function useLessonCalendarModel(lessons: CalendarLesson[]): LessonCalendarModel {
  const me = trpc.me.useQuery();
  const admin = isAdministrativeRole(me.data?.role);
  const selection = useCalendarSelection();
  const [types, setTypes] = useState<string[]>(() => Object.keys(EVENT_LABELS));
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teachers, setTeachers] = useState<SearchSelectOption[]>([]);
  const [formats, setFormats] = useState<string[]>(["Presencial", "Online"]);
  const filters = { types, teachers, formats };
  const filtered = filterLessons(lessons, filters);
  const restricted = filtersRestricted(filters);
  function resetFilters(): void {
    setTypes(Object.keys(EVENT_LABELS));
    setTeacherSearch("");
    setTeachers([]);
    setFormats(["Presencial", "Online"]);
  }
  return {
    admin,
    ...selection,
    types,
    setTypes,
    teacherSearch,
    setTeacherSearch,
    teachers,
    setTeachers,
    formats,
    setFormats,
    filtered,
    restricted,
    resetFilters,
  };
}
