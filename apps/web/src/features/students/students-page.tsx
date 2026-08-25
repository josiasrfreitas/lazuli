"use client";

import type { ReactElement, ReactNode } from "react";

import { Pagination } from "@lazuli/ui";

import { useStudentsFilters, useStudentsList, type StudentsListQuery } from "./logic";
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
  const students = useStudentsList(filters);
  const state = tableStateVm({
    rows: students.data?.rows,
    isError: students.error !== null,
    filtered: filters.busca !== "" || filters.statusTab !== "todos",
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-8">
      <StudentsHeader
        summary={students.data === undefined ? null : headerSummaryVm(students.data)}
      />
      {students.data === undefined ? null : (
        <StudentsControls filters={filters} tabs={statusTabsVm(students.data.counts)} />
      )}
      <StudentsTable
        onRetry={() => {
          void students.refetch();
        }}
        state={state}
      />
      <StudentsPagination data={students.data} onPageChange={filters.setPagina} />
    </div>
  );
}
