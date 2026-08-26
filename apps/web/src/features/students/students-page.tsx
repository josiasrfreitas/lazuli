"use client";

import { useState, type ReactElement, type ReactNode } from "react";

import { Pagination } from "@lazuli/ui";

import {
  useSelectedStudent,
  useStudentsFilters,
  useStudentsList,
  type StudentsListQuery,
} from "./logic";
import { NewStudentDialog } from "./new-student/new-student-dialog";
import { StudentPreviewPanel } from "./student-preview-panel";
import { StudentsTable } from "./students-table";
import { StudentsControls, StudentsHeader } from "./students-toolbar";
import { headerSummaryVm, statusTabsVm, tableStateVm } from "./view-model";

function StudentsPagination({
  data,
  onPageChange,
}: {
  data: StudentsListQuery["data"];
  onPageChange: (page: number) => void;
}): ReactNode {
  if (data === undefined || data.pageCount <= 1) {
    return null;
  }

  return (
    <div className="flex justify-end">
      <Pagination onPageChange={onPageChange} page={data.page} pageCount={data.pageCount} />
    </div>
  );
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
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-8">
      <StudentsHeader
        onNewStudent={() => {
          setCreating(true);
        }}
        summary={students.data === undefined ? null : headerSummaryVm(students.data)}
      />
      <StudentsControls filters={filters} tabs={statusTabsVm(students.data?.counts)} />
      <StudentsTable
        onRetry={() => {
          void students.refetch();
        }}
        onSelectRow={selection.select}
        selectedId={selection.selectedId}
        state={state}
      />
      <StudentsPagination data={students.data} onPageChange={filters.setPagina} />
      <StudentPreviewPanel selection={selection} />
      <NewStudentDialog
        onCreated={(id) => {
          setCreating(false);
          selection.select(id);
        }}
        onOpenChange={setCreating}
        open={creating}
      />
    </div>
  );
}
