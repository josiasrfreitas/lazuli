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

import { StudentsTableRow } from "./students-table-row";
import type { TablePaginationAdapterProps } from "~/lib/pagination";
import type { StudentsTableState } from "./view-model";

// Explicit widths + `table-fixed` keep the columns in place across the data,
// loading and empty states — with auto layout the empty row's colspan lets
// the headers slide between states.
const COLUMNS = [
  { label: "Aluno", numeric: false },
  { label: "Turma", numeric: false },
  { label: "Professor", numeric: false },
  { label: "Frequência", numeric: true },
  { label: "Financeiro", numeric: true },
] as const satisfies readonly { label: string; numeric: boolean }[];
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

export type StudentsTablePagination = TablePaginationAdapterProps;

function StudentsPagination({ pagination }: { pagination: StudentsTablePagination }): ReactNode {
  return <TablePagination itemLabel={{ singular: "aluno", plural: "alunos" }} {...pagination} />;
}

function StudentsTableHead({ column }: { column: (typeof COLUMNS)[number] }): ReactElement {
  switch (column.label) {
    case "Aluno": {
      return <TableHead className="w-[30%]">{column.label}</TableHead>;
    }
    case "Turma": {
      return <TableHead className="w-[15%]">{column.label}</TableHead>;
    }
    case "Professor": {
      return <TableHead className="w-[17%]">{column.label}</TableHead>;
    }
    case "Frequência": {
      return (
        <TableHead className="w-[15%]" numeric>
          {column.label}
        </TableHead>
      );
    }
    case "Financeiro": {
      return (
        <TableHead className="w-[15%]" numeric>
          {column.label}
        </TableHead>
      );
    }
  }
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
              <StudentsTableHead column={column} key={column.label} />
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
