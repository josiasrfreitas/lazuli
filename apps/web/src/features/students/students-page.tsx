"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import { CircleCheck, GraduationCap, Plus, Search, UsersRound } from "lucide-react";

import {
  Button,
  DataTablePage,
  Input,
  TableFilterChips,
  TableFilters,
  type RemoteOptionsResult,
  type TableFilterField,
} from "@lazuli/ui";
import {
  STUDENT_FILTER_OPTION_SEARCH_MAX_LENGTH,
  studentPaginationPolicy,
} from "@lazuli/validators";
import { tablePaginationPropsFor, type UrlPagination } from "~/lib/pagination";
import { debounce } from "~/lib/debounce";

import {
  useSelectedStudent,
  useStudentFilterOptions,
  useSelectedStudentFilterOptions,
  useStudentsFilters,
  useStudentsList,
  type StudentsFilters,
} from "./logic";
import { studentFilterOptionResult } from "./filter-options";
import { NewStudentDialog } from "./new-student/new-student-dialog";
import { StudentPreviewPanel } from "./student-preview-panel";
import { StudentsTable } from "./students-table";
import { tableStateVm } from "./view-model";

const SEARCH_DEBOUNCE_MS = 300;

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
      searchMaxLength: STUDENT_FILTER_OPTION_SEARCH_MAX_LENGTH,
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
      searchMaxLength: STUDENT_FILTER_OPTION_SEARCH_MAX_LENGTH,
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

function SearchField({ filters }: { filters: StudentsFilters }): ReactElement {
  const [value, setValue] = useState(filters.search);
  const commitSearch = useMemo(
    () => debounce((nextValue: string) => filters.setSearch(nextValue), SEARCH_DEBOUNCE_MS),
    [filters.setSearch],
  );
  useEffect(() => {
    setValue(filters.search);
    commitSearch.cancel();
  }, [commitSearch, filters.search]);
  useEffect(() => () => commitSearch.cancel(), [commitSearch]);
  return (
    <div className="relative w-full sm:w-80">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        aria-label="Buscar aluno"
        className="pl-8"
        onChange={(event) => {
          const nextValue = event.target.value;
          setValue(nextValue);
          commitSearch(nextValue);
        }}
        placeholder="Buscar por nome, turma ou professor"
        size="sm"
        type="search"
        value={value}
      />
    </div>
  );
}

export function StudentsControls({
  filters,
  fields,
  onNewStudent,
}: {
  filters: StudentsFilters;
  fields: TableFilterField[];
  onNewStudent: () => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchField filters={filters} />
      <TableFilters
        fields={fields}
        onClearAll={() =>
          filters.setFilters({
            situations: null,
            classIds: null,
            teacherIds: null,
            registeredFrom: null,
            registeredTo: null,
          })
        }
      />
      <Button onClick={onNewStudent} size="sm">
        <Plus aria-hidden="true" className="size-4" />
        Novo aluno
      </Button>
    </div>
  );
}

function paginationFor(filters: ReturnType<typeof useStudentsFilters>): UrlPagination {
  return {
    page: filters.page,
    pageSize: filters.pageSize,
    pageSizeOptions: studentPaginationPolicy.pageSizeOptions,
    setPage: filters.setPage,
    setPageSize: filters.setPageSize,
  };
}

function useStudentFilterFields(
  filters: ReturnType<typeof useStudentsFilters>,
): TableFilterField[] {
  const [classSearch, setClassSearch] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const classes = useStudentFilterOptions("class", classSearch);
  const teachers = useStudentFilterOptions("teacher", teacherSearch);
  const selectedClasses = useSelectedStudentFilterOptions("class", filters.classIds);
  const selectedTeachers = useSelectedStudentFilterOptions("teacher", filters.teacherIds);
  return studentFilterFields({
    filters,
    classOptions: (selectedClasses.data ?? []).filter((option) =>
      filters.classIds.includes(option.id),
    ),
    teacherOptions: (selectedTeachers.data ?? []).filter((option) =>
      filters.teacherIds.includes(option.id),
    ),
    classSearch,
    teacherSearch,
    classResult: studentFilterOptionResult(classSearch, classes),
    teacherResult: studentFilterOptionResult(teacherSearch, teachers),
    onClassSearchChange: setClassSearch,
    onTeacherSearchChange: setTeacherSearch,
  });
}

function hasStudentFilters(filters: ReturnType<typeof useStudentsFilters>): boolean {
  return Boolean(
    filters.search ||
    filters.situations.length > 0 ||
    filters.classIds.length > 0 ||
    filters.teacherIds.length > 0 ||
    filters.registeredFrom ||
    filters.registeredTo,
  );
}

function studentTableState(
  filters: ReturnType<typeof useStudentsFilters>,
  students: ReturnType<typeof useStudentsList>,
): ReturnType<typeof tableStateVm> {
  return tableStateVm({
    rows: students.data?.rows,
    isError: students.error !== null,
    filtered: hasStudentFilters(filters),
  });
}

export function StudentsPage(): ReactElement {
  const filters = useStudentsFilters();
  const selection = useSelectedStudent();
  const students = useStudentsList(filters);
  const fields = useStudentFilterFields(filters);
  const [creating, setCreating] = useState(false);
  const pagination = paginationFor(filters);

  return (
    <>
      <DataTablePage
        controls={
          <StudentsControls
            filters={filters}
            fields={fields}
            onNewStudent={() => {
              setCreating(true);
            }}
          />
        }
        title="Alunos"
      >
        <div className="flex h-full min-h-0 flex-col gap-2">
          <TableFilterChips fields={fields} />
          <div className="min-h-0 flex-1">
            <StudentsTable
              onRetry={() => {
                void students.refetch();
              }}
              onSelectRow={selection.select}
              selectedId={selection.selectedId}
              state={studentTableState(filters, students)}
              pagination={tablePaginationPropsFor(pagination, students.data)}
            />
          </div>
        </div>
      </DataTablePage>
      <StudentPreviewPanel selection={selection} />
      <NewStudentDialog
        onCreated={(id) => {
          setCreating(false);
          selection.select(id);
        }}
        onOpenChange={setCreating}
        open={creating}
      />
    </>
  );
}
