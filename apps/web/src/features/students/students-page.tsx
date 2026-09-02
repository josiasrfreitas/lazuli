"use client";

import { useState, type ReactElement } from "react";

import { DataTablePage } from "@lazuli/ui";

import {
  useSelectedStudent,
  useStudentsFilters,
  useStudentsList,
  type StudentsFilters,
  type StudentsListQuery,
} from "./logic";
import { NewStudentDialog } from "./new-student/new-student-dialog";
import { StudentPreviewPanel } from "./student-preview-panel";
import { StudentsTable, type StudentsTablePagination } from "./students-table";
import { StudentsControls, StudentsHeader } from "./students-toolbar";
import { headerSummaryVm, statusTabsVm, tableStateVm } from "./view-model";

export function paginationFor(
  data: StudentsListQuery["data"],
  filters: Pick<StudentsFilters, "pagina" | "pageSize" | "setPagina" | "setPageSize">,
): StudentsTablePagination {
  const base = {
    onPageChange: filters.setPagina,
    onPageSizeChange: filters.setPageSize,
    page: data?.page ?? filters.pagina,
    pageSize: data?.pageSize ?? filters.pageSize,
  };

  return data === undefined
    ? { ...base, loading: true }
    : { ...base, pageCount: data.pageCount, totalItems: data.total };
}

export function StudentsPage(): ReactElement {
  const filters = useStudentsFilters();
  const selection = useSelectedStudent();
  const students = useStudentsList(filters);
  const [creating, setCreating] = useState(false);
  const state = tableStateVm({
    rows: students.data?.rows,
    isError: students.error !== null,
    filtered: filters.busca !== "" || filters.statusTab !== "todos",
  });

  return (
    <>
      <DataTablePage
        controls={<StudentsControls filters={filters} tabs={statusTabsVm(students.data?.counts)} />}
        header={
          <StudentsHeader
            onNewStudent={() => {
              setCreating(true);
            }}
            summary={headerSummaryVm(students.data)}
          />
        }
      >
        <StudentsTable
          onRetry={() => {
            void students.refetch();
          }}
          onSelectRow={selection.select}
          selectedId={selection.selectedId}
          state={state}
          pagination={paginationFor(students.data, filters)}
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
