"use client";

import { useEffect, useState, type ReactElement } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BadgePercent,
  Cake,
  CircleCheck,
  GraduationCap,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";

import {
  Button,
  DataTablePage,
  Input,
  TableFilters,
  type RemoteOptionsResult,
  type TableFilterField,
} from "@lazuli/ui";
import {
  STUDENT_FILTER_OPTION_SEARCH_MAX_LENGTH,
  studentPaginationPolicy,
  type StudentListOutput,
} from "@lazuli/validators";
import { tablePaginationPropsFor, type UrlPagination } from "~/lib/pagination";
import { useSearchDraft } from "~/lib/use-search-draft";
import { useAnimationPreviewDelay } from "~/lib/animation-preview";

import {
  useStudentFilterOptions,
  useSelectedStudentFilterOptions,
  useStudentsFilters,
  useStudentsList,
  type StudentsFilters,
} from "./logic";
import { studentFilterOptionResult } from "./filter-options";
import { StudentsTable } from "./students-table";
import { tableStateVm } from "./view-model";

const STUDENT_PREVIEW_DELAY_MS = 1600;
const NewStudentDialog = dynamic(
  () => import("./new-student/new-student-dialog").then((module) => module.NewStudentDialog),
  { loading: () => <p role="status">Carregando cadastro do aluno...</p> },
);

export type InitialStudentsData = {
  list?: { data: StudentListOutput; updatedAt: number };
  classOptions?: { data: Array<{ id: string; label: string }>; updatedAt: number };
};

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
    {
      id: "scholarship",
      label: "Bolsa",
      kind: "options",
      icon: BadgePercent,
      options: [
        { id: "scholarship", label: "Bolsista" },
        { id: "regular", label: "Sem bolsa" },
      ],
      selected: filters.scholarship,
      onChange: (values) => filters.setFilters({ scholarship: values.join(",") || null }),
      onClear: () => filters.setFilters({ scholarship: null }),
    },
    {
      id: "ageRanges",
      label: "Faixa etária",
      kind: "options",
      icon: Cake,
      options: [
        { id: "under13", label: "Até 12 anos" },
        { id: "teen", label: "13 a 17 anos" },
        { id: "adult", label: "18 anos ou mais" },
      ],
      selected: filters.ageRanges,
      onChange: (values) => filters.setFilters({ ageRanges: values.join(",") || null }),
      onClear: () => filters.setFilters({ ageRanges: null }),
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
  const [value, setValue] = useSearchDraft(filters.search, filters.setSearch);
  return (
    <div className="relative w-full sm:w-80">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-icon"
      />
      <Input
        aria-label="Buscar aluno"
        className="pl-8"
        onChange={(event) => {
          const nextValue = event.target.value;
          setValue(nextValue);
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
            scholarship: null,
            ageRanges: null,
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
  initialClassOptions?: InitialStudentsData["classOptions"],
): TableFilterField[] {
  const [classSearch, setClassSearch] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const classes = useStudentFilterOptions("class", {
    search: classSearch,
    initial: initialClassOptions,
  });
  const teachers = useStudentFilterOptions("teacher", { search: teacherSearch });
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
    classResult: studentFilterOptionResult(classSearch, { ...classes, preload: true }),
    teacherResult: studentFilterOptionResult(teacherSearch, teachers),
    onClassSearchChange: setClassSearch,
    onTeacherSearchChange: setTeacherSearch,
  });
}

function hasStudentFilters(filters: ReturnType<typeof useStudentsFilters>): boolean {
  return Boolean(
    filters.search ||
    filters.situations.length > 0 ||
    filters.scholarship.length > 0 ||
    filters.ageRanges.length > 0 ||
    filters.classIds.length > 0 ||
    filters.teacherIds.length > 0 ||
    filters.registeredFrom ||
    filters.registeredTo,
  );
}

function studentTableState({
  filters,
  students,
  previewReady,
}: {
  filters: ReturnType<typeof useStudentsFilters>;
  students: ReturnType<typeof useStudentsList>;
  previewReady: boolean;
}): ReturnType<typeof tableStateVm> {
  return tableStateVm({
    rows: previewReady ? students.data?.rows : undefined,
    isError: students.error !== null,
    filtered: hasStudentFilters(filters),
  });
}

export function StudentsPage({ initial }: { initial?: InitialStudentsData }): ReactElement {
  const previewReady = useAnimationPreviewDelay(STUDENT_PREVIEW_DELAY_MS);
  const filters = useStudentsFilters();
  const openStudent = useOpenStudent();
  const defaultList =
    filters.page === 1 &&
    filters.pageSize === studentPaginationPolicy.defaultPageSize &&
    !hasStudentFilters(filters);
  const students = useStudentsList(filters, defaultList ? initial?.list : undefined);
  const fields = useStudentFilterFields(filters, initial?.classOptions);
  const [creating, setCreating] = useState(false);
  const [resuming, setResuming] = useState<string | null>(null);
  const pagination = paginationFor(filters);
  const startCreating = (): void => setCreating(true);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (
        event.key.toLowerCase() !== "n" ||
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        event.shiftKey
      )
        return;
      if (creating || resuming) return;
      event.preventDefault();
      setCreating(true);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [creating, resuming]);

  return (
    <>
      <DataTablePage
        controls={
          <StudentsControls filters={filters} fields={fields} onNewStudent={startCreating} />
        }
        title="Alunos"
      >
        <StudentsTableSection
          filters={filters}
          students={students}
          previewReady={previewReady}
          pagination={pagination}
          onOpenStudent={openStudent}
          onContinue={setResuming}
        />
      </DataTablePage>
      {(creating || Boolean(resuming)) && (
        <NewStudentDialog
          onCreated={(id) => {
            setCreating(false);
            if (resuming) {
              setResuming(null);
              void students.refetch();
            } else openStudent(id);
          }}
          existingStudentId={resuming ?? undefined}
          onOpenChange={(open) => {
            if (!open) {
              setCreating(false);
              setResuming(null);
            }
          }}
          open
        />
      )}
    </>
  );
}

function useOpenStudent(): (id: string) => void {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (id: string): void => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("aluno");
    const back = params.size > 0 ? `/alunos?${params.toString()}` : "/alunos";
    router.push(`/alunos/${id}?voltar=${encodeURIComponent(back)}`);
  };
}

function StudentsTableSection({
  filters,
  students,
  previewReady,
  pagination,
  onOpenStudent,
  onContinue,
}: {
  filters: ReturnType<typeof useStudentsFilters>;
  students: ReturnType<typeof useStudentsList>;
  previewReady: boolean;
  pagination: ReturnType<typeof paginationFor>;
  onOpenStudent: (id: string) => void;
  onContinue: (id: string) => void;
}): ReactElement {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="min-h-0 flex-1">
        <StudentsTable
          onRetry={() => void students.refetch()}
          onOpenRow={onOpenStudent}
          onContinue={onContinue}
          state={studentTableState({ filters, students, previewReady })}
          pagination={tablePaginationPropsFor(pagination, previewReady ? students.data : undefined)}
        />
      </div>
    </div>
  );
}
