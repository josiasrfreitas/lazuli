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
  TableRow,
  TableSkeleton,
} from "@lazuli/ui";

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
const SKELETON_ROWS = 8;

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

export function StudentsTable({
  state,
  onRetry,
  selectedId,
  onSelectRow,
}: {
  state: StudentsTableState;
  onRetry: () => void;
  selectedId: string | null;
  onSelectRow: (id: string) => void;
}): ReactElement {
  return (
    <TableContainer>
      <Table aria-label="Lista de alunos" className="min-w-2xl table-fixed">
        <TableHeader>
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
