"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { DataTable, Input, TableFilters } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { SemesterBoard } from "./shared";
import { studentPoolColumns, type Student } from "./student-pool-columns";

const STUDENT_PAGE_SIZE = 20;
export function StudentPool({
  board,
  readOnly,
  onOrganize,
}: {
  board: SemesterBoard;
  readOnly: boolean;
  onOrganize: (studentId: string) => void;
}): ReactJSX.Element {
  const [search, setSearch] = useState("");
  const [unassigned, setUnassigned] = useState(true);
  const [page, setPage] = useState(1);
  const query = trpc.semesterOrganization.students.useQuery({
    semesterId: board.semester.id,
    search,
    unassigned,
    page,
  });
  const changeSearch = (value: string): void => {
    setSearch(value);
    setPage(1);
  };
  const changeUnassigned = (value: boolean): void => {
    setUnassigned(value);
    setPage(1);
  };
  return (
    <div className="grid min-w-0 gap-4">
      <StudentPoolFilters
        search={search}
        unassigned={unassigned}
        onSearch={changeSearch}
        onUnassigned={changeUnassigned}
      />
      <StudentPoolTable
        board={board}
        readOnly={readOnly}
        onOrganize={onOrganize}
        search={search}
        page={page}
        onPageChange={setPage}
        pending={query.isPending}
        error={Boolean(query.error)}
        rows={query.data?.rows}
        total={query.data?.total ?? 0}
        onRetry={() => void query.refetch()}
      />
    </div>
  );
}

function StudentPoolTable({
  board,
  readOnly,
  onOrganize,
  search,
  page,
  onPageChange,
  pending,
  error,
  rows,
  total,
  onRetry,
}: {
  board: SemesterBoard;
  readOnly: boolean;
  onOrganize: (studentId: string) => void;
  search: string;
  page: number;
  onPageChange: (page: number) => void;
  pending: boolean;
  error: boolean;
  rows: Student[] | undefined;
  total: number;
  onRetry: () => void;
}): ReactJSX.Element {
  return (
    <DataTable
      label="Alunos a organizar"
      columns={studentPoolColumns({ board, readOnly, onOrganize })}
      state={studentTableState({ pending, error, rows, search })}
      onRetry={onRetry}
      empty={{
        title: "Todos os alunos deste recorte foram organizados",
        description: "Remova o filtro para revisar propostas existentes.",
      }}
      errorTitle="Não foi possível carregar os alunos"
      pagination={{
        page,
        pageSize: 25,
        pageCount: Math.max(1, Math.ceil(total / STUDENT_PAGE_SIZE)),
        totalItems: total,
        onPageChange,
        itemLabel: { singular: "aluno", plural: "alunos" },
      }}
    />
  );
}

function StudentPoolFilters({
  search,
  unassigned,
  onSearch,
  onUnassigned,
}: {
  search: string;
  unassigned: boolean;
  onSearch: (value: string) => void;
  onUnassigned: (value: boolean) => void;
}): ReactJSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="w-full sm:w-80">
        <Input
          name="organization-search"
          autoComplete="off"
          size="sm"
          aria-label="Buscar aluno"
          placeholder="Buscar aluno pelo nome"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>
      <TableFilters
        fields={[
          {
            id: "unassigned",
            label: "Organização",
            kind: "options",
            promoted: true,
            options: [{ id: "yes", label: "Sem proposta neste semestre" }],
            selected: unassigned ? ["yes"] : [],
            onChange: (value) => onUnassigned(value.includes("yes")),
            onClear: () => onUnassigned(false),
          },
        ]}
        onClearAll={() => onUnassigned(false)}
      />
    </div>
  );
}

function studentTableState({
  pending,
  error,
  rows,
  search,
}: {
  pending: boolean;
  error: boolean;
  rows: Student[] | undefined;
  search: string;
}):
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "data"; rows: Student[] }
  | { kind: "noResults" }
  | { kind: "empty" } {
  if (pending) return { kind: "loading" };
  if (error) return { kind: "error" };
  if (rows?.length) return { kind: "data", rows };
  return search ? { kind: "noResults" } : { kind: "empty" };
}
