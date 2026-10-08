import {
  BookOpen,
  CalendarDays,
  CircleCheck,
  GraduationCap,
  Monitor,
  UsersRound,
} from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import type { TableFilterField, TableFilterOption } from "@lazuli/ui";
import { classListQueryInput, type ClassListParams } from "./class-list-model";

type FilterKey = "tipo" | "formato" | "professor" | "estagio" | "semestre" | "estado";
type FormOptions = RouterOutputs["classes"]["formOptions"];
const FILTER_CONFIG = {
  tipo: { label: "Modalidade", icon: UsersRound, promoted: true },
  formato: { label: "Formato", icon: Monitor, promoted: true },
  professor: { label: "Professor", icon: GraduationCap, promoted: true },
  estagio: { label: "Estágio", icon: BookOpen, presentation: "dropdown" },
  semestre: { label: "Semestre", icon: CalendarDays },
  estado: { label: "Estado", icon: CircleCheck },
} as const;

function filterOptions(data: FormOptions | undefined): Record<FilterKey, TableFilterOption[]> {
  return {
    tipo: [
      { id: "REGULAR", label: "Regular" },
      { id: "PERSONALIZED", label: "PPT" },
    ],
    formato: [
      { id: "IN_PERSON", label: "Presencial" },
      { id: "ONLINE", label: "Online" },
    ],
    professor: data?.teachers.map(({ id, name }) => ({ id, label: name })) ?? [],
    estagio: data?.stages.map(({ id, name }) => ({ id, label: name })) ?? [],
    semestre: data?.semesters.map(({ id, name }) => ({ id, label: name })) ?? [],
    estado: [
      { id: "ACTIVE", label: "Ativa" },
      { id: "ARCHIVED", label: "Arquivada" },
    ],
  };
}

export function classFilterFields({
  params,
  options,
  change,
}: {
  params: ClassListParams;
  options: FormOptions | undefined;
  change: (value: Partial<ClassListParams>) => void;
}): TableFilterField[] {
  const input = classListQueryInput(params);
  const selected: Record<FilterKey, string[]> = {
    tipo: input.scheduleTypes,
    formato: input.formats,
    professor: input.teacherIds,
    estagio: input.stageIds,
    semestre: input.semesterIds,
    estado: input.statuses,
  };
  const choices = filterOptions(options);
  return (Object.keys(FILTER_CONFIG) as FilterKey[]).map((id) => ({
    id,
    ...FILTER_CONFIG[id],
    kind: "options",
    options: choices[id],
    selected: selected[id],
    onChange: (values) => change({ [id]: values.join(",") || null, pagina: 1 }),
    onClear: () => change({ [id]: null, pagina: 1 }),
  }));
}
