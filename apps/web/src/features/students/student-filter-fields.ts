import { CircleCheck, GraduationCap, UsersRound } from "lucide-react";
import type { RemoteOptionsResult, TableFilterField } from "@lazuli/ui";
import type { StudentsFilters } from "./logic";

export type StudentsFilterFieldsProps = {
  filters: StudentsFilters;
  classOptions: { id: string; label: string }[];
  teacherOptions: { id: string; label: string }[];
  classSearch: string;
  teacherSearch: string;
  classResult: RemoteOptionsResult;
  teacherResult: RemoteOptionsResult;
  onClassSearchChange: (value: string) => void;
  onTeacherSearchChange: (value: string) => void;
};

function remoteFilterFields({
  filters,
  classOptions,
  teacherOptions,
  classSearch,
  teacherSearch,
  classResult,
  teacherResult,
  onClassSearchChange,
  onTeacherSearchChange,
}: StudentsFilterFieldsProps): TableFilterField[] {
  return [
    {
      id: "classes",
      label: "Turma",
      kind: "remote-options",
      icon: UsersRound,
      promoted: true,
      selected: filters.classIds,
      selectedOptions: classOptions,
      search: classSearch,
      result: classResult,
      onSearchChange: onClassSearchChange,
      onChange: (values) => filters.setFilters({ classIds: values.join(",") || null }),
      onClear: () => filters.setFilters({ classIds: null }),
    },
    {
      id: "teachers",
      label: "Professor",
      kind: "remote-options",
      icon: GraduationCap,
      selected: filters.teacherIds,
      selectedOptions: teacherOptions,
      search: teacherSearch,
      result: teacherResult,
      onSearchChange: onTeacherSearchChange,
      onChange: (values) => filters.setFilters({ teacherIds: values.join(",") || null }),
      onClear: () => filters.setFilters({ teacherIds: null }),
    },
  ];
}

export function studentFilterFields(props: StudentsFilterFieldsProps): TableFilterField[] {
  const { filters } = props;
  return [
    {
      id: "situations",
      label: "Situação",
      kind: "options",
      icon: CircleCheck,
      promoted: true,
      options: [
        { id: "active", label: "Ativo" },
        { id: "inactive", label: "Inativo" },
      ],
      selected: filters.situations,
      onChange: (values) => filters.setFilters({ situations: values.join(",") || null }),
      onClear: () => filters.setFilters({ situations: null }),
    },
    ...remoteFilterFields(props),
    {
      id: "registered",
      label: "Data de cadastro",
      kind: "period",
      from: filters.registeredFrom,
      to: filters.registeredTo,
      onChange: (from, to) => {
        if (from && to && from > to) {
          if (from === filters.registeredFrom) from = "";
          else to = "";
        }
        filters.setFilters({ registeredFrom: from || null, registeredTo: to || null });
      },
      onClear: () => filters.setFilters({ registeredFrom: null, registeredTo: null }),
    },
  ];
}
