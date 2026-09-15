"use client";

import { useState, type ReactElement } from "react";

import { DataTablePage } from "@lazuli/ui";
import { studentPaginationPolicy } from "@lazuli/validators";
import { tablePaginationPropsFor, type UrlPagination } from "~/lib/pagination";

import { useSelectedStudent, useStudentsFilters, useStudentsList } from "./logic";
import { NewStudentDialog } from "./new-student/new-student-dialog";
import { StudentPreviewPanel } from "./student-preview-panel";
import { StudentsTable } from "./students-table";
import { StudentsControls, StudentsHeader } from "./students-toolbar";
import { headerSummaryVm, statusTabsVm, tableStateVm } from "./view-model";

function paginationFor(filters: ReturnType<typeof useStudentsFilters>): UrlPagination {
  return {
    page: filters.page,
    pageSize: filters.pageSize,
    pageSizeOptions: studentPaginationPolicy.pageSizeOptions,
    setPage: filters.setPage,
    setPageSize: filters.setPageSize,
  };
}

export function StudentsPage(): ReactElement {
  const filters = useStudentsFilters();
  const selection = useSelectedStudent();
  const students = useStudentsList(filters);
  const [creating, setCreating] = useState(false);
  const state = tableStateVm({
    rows: students.data?.rows,
    isError: students.error !== null,
    filtered: filters.search !== "" || filters.statusTab !== "todos",
  });
  const pagination = paginationFor(filters);

  return (
    <>
      <DataTablePage
        controls={
          <StudentsControls
            filters={filters}
            onNewStudent={() => {
              setCreating(true);
            }}
            tabs={statusTabsVm(students.data?.counts)}
          />
        }
        header={<StudentsHeader summary={headerSummaryVm(students.data)} />}
      >
        <StudentsTable
          onRetry={() => {
            void students.refetch();
          }}
          onSelectRow={selection.select}
          selectedId={selection.selectedId}
          state={state}
          pagination={tablePaginationPropsFor(pagination, students.data)}
        />
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
