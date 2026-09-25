"use client";

import { useState, type ReactElement } from "react";

import { DataTablePage, TableFilterChips, type TableFilterField } from "@lazuli/ui";
import { studentPaginationPolicy } from "@lazuli/validators";
import { tablePaginationPropsFor, type UrlPagination } from "~/lib/pagination";

import {
  useSelectedStudent,
  useStudentFilterOptions,
  useSelectedStudentFilterOptions,
  useStudentsFilters,
  useStudentsList,
} from "./logic";
import { studentFilterOptionResult } from "./filter-options";
import { NewStudentDialog } from "./new-student/new-student-dialog";
import { StudentPreviewPanel } from "./student-preview-panel";
import { StudentsTable } from "./students-table";
import { studentFilterFields } from "./student-filter-fields";
import { StudentsControls, StudentsSummary } from "./students-toolbar";
import { headerSummaryVm, tableStateVm } from "./view-model";

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
        summary={<StudentsSummary summary={headerSummaryVm(students.data)} />}
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
