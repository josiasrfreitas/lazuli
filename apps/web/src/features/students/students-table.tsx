import type { ReactElement, ReactNode } from "react";

import { SearchX, UserRoundPlus } from "lucide-react";

import {
  Button,
  EmptyState,
  Table,
  TableBody,
  TableContainer,
  TableEmpty,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
  TableSkeleton,
} from "@lazuli/ui";
import { STUDENT_PAGE_SIZE_OPTIONS, type StudentListInput } from "@lazuli/validators";

import { StudentsTableRow } from "./students-table-row";
import type { StudentsTableState } from "./view-model";

const FACT_WIDTH = "w-[15%]";

// Explicit widths + `table-fixed` keep the columns in place across the data,
// loading and empty states — with auto layout the empty row's colspan lets
// the headers slide between states.
const COLUMNS: readonly { label: string; width: string; numeric: boolean }[] = [
  { label: "Aluno", width: "w-[30%]", numeric: false },
  { label: "Turma", width: FACT_WIDTH, numeric: false },
  { label: "Professor", width: "w-[17%]", numeric: false },
  { label: "Frequência", width: FACT_WIDTH, numeric: true },
  { label: "Financeiro", width: FACT_WIDTH, numeric: true },
];
const COLUMN_COUNT = COLUMNS.length + 1;
const NUMERIC_COLUMNS = COLUMNS.flatMap((column, index) => (column.numeric ? [index] : []));
const SKELETON_ROWS = 10;

function StatesRow({
  state,
  onRetry,
}: {
  state: StudentsTableState;
  onRetry: () => void;
}): ReactNode {
  if (state.kind === "loading") {
    return (
      <TableSkeleton columns={COLUMN_COUNT} numericColumns={NUMERIC_COLUMNS} rows={SKELETON_ROWS} />
    );
  }

  if (state.kind === "error") {
    return (
      <TableEmpty colSpan={COLUMN_COUNT}>
        <EmptyState
          action={
            <Button onClick={onRetry} size="sm" variant="secondary">
              Tentar de novo
            </Button>
          }
          title="Não foi possível carregar os alunos"
          description="Verifique a conexão e tente de novo."
        />
      </TableEmpty>
    );
  }

  if (state.kind === "noResults") {
    return (
      <TableEmpty colSpan={COLUMN_COUNT}>
        <EmptyState
          description="Ajuste a busca ou o filtro de status."
          icon={<SearchX />}
          title="Nenhum aluno encontrado"
        />
      </TableEmpty>
    );
  }

  return (
    <TableEmpty colSpan={COLUMN_COUNT}>
      <EmptyState
        description="Cadastre o primeiro aluno para começar."
        icon={<UserRoundPlus />}
        title="Nenhum aluno cadastrado"
      />
    </TableEmpty>
  );
}

type StudentsTablePaginationBase = {
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: StudentListInput["pageSize"]) => void;
  page: number;
  pageSize: StudentListInput["pageSize"];
};

export type StudentsTablePagination = StudentsTablePaginationBase &
  (
    | { loading: true; pageCount?: never; totalItems?: never }
    | { loading?: false; pageCount: number; totalItems: number }
  );

function isStudentPageSize(pageSize: number): pageSize is StudentListInput["pageSize"] {
  return (STUDENT_PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSize);
}

function StudentsPagination({ pagination }: { pagination: StudentsTablePagination }): ReactNode {
  return (
    <TablePagination
      itemLabel={{ singular: "aluno", plural: "alunos" }}
      onPageChange={pagination.onPageChange}
      onPageSizeChange={(pageSize) => {
        if (isStudentPageSize(pageSize)) {
          pagination.onPageSizeChange(pageSize);
        }
      }}
      page={pagination.page}
      pageSize={pagination.pageSize}
      pageSizeOptions={STUDENT_PAGE_SIZE_OPTIONS}
      {...(pagination.loading
        ? { loading: true }
        : { pageCount: pagination.pageCount, totalItems: pagination.totalItems })}
    />
  );
}

export function StudentsTable({
  state,
  onRetry,
  selectedId,
  onSelectRow,
  pagination,
}: {
  state: StudentsTableState;
  onRetry: () => void;
  selectedId: string | null;
  onSelectRow: (id: string) => void;
  pagination: StudentsTablePagination;
}): ReactElement {
  return (
    <TableContainer footer={<StudentsPagination pagination={pagination} />} viewportBound>
      <Table aria-label="Lista de alunos" className="min-w-2xl table-fixed">
        <TableHeader sticky>
          <TableRow className="hover:bg-transparent">
            {COLUMNS.map((column) => (
              <TableHead className={column.width} key={column.label} numeric={column.numeric}>
                {column.label}
              </TableHead>
            ))}
            <TableHead className="w-16 text-center">
              <span className="sr-only">Contato</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {state.kind === "data" ? (
            state.rows.map((row) => (
              <StudentsTableRow
                key={row.id}
                onSelect={onSelectRow}
                row={row}
                selected={row.id === selectedId}
              />
            ))
          ) : (
            <StatesRow onRetry={onRetry} state={state} />
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
