import type { ReactElement, ReactNode } from "react";

import { ClipboardList, MessageCircle, SearchX, UserRoundPlus } from "lucide-react";

import type { StudentListRow } from "@lazuli/validators";
import {
  Avatar,
  Badge,
  Button,
  cn,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableEmpty,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
  TableSkeleton,
} from "@lazuli/ui";

import { EM_DASH } from "~/lib/format";
import type { TablePaginationAdapterProps } from "~/lib/pagination";
import {
  attendanceCellVm,
  financeCellVm,
  whatsAppVm,
  type FactCellVm,
  type StudentsTableState,
} from "./view-model";

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

function FactCell({ vm }: { vm: FactCellVm }): ReactElement {
  const content = <span className={cn(vm.numeric && "font-numeric")}>{vm.label}</span>;

  if (vm.tone === "muted") {
    return (
      <TableCell className="text-muted-foreground" numeric>
        {content}
      </TableCell>
    );
  }

  if (vm.tone === "success") {
    return (
      <TableCell className="text-success" numeric>
        {content}
      </TableCell>
    );
  }

  if (vm.tone === "destructive") {
    return (
      <TableCell className="text-destructive" numeric>
        {content}
      </TableCell>
    );
  }

  return <TableCell numeric>{content}</TableCell>;
}

function EnrollmentCell({ enrollment }: { enrollment: StudentListRow["enrollment"] }): ReactNode {
  if (enrollment === null) {
    return <TableCell className="text-muted-foreground">{EM_DASH}</TableCell>;
  }

  return (
    <TableCell>
      <div className="flex flex-col gap-0.5">
        <span className="font-numeric tabular-nums">{enrollment.classCode}</span>
        <span className="text-micro text-muted-foreground">{enrollment.scheduleLabel}</span>
      </div>
    </TableCell>
  );
}

function StudentActions({ row, onContinue }: { row: StudentListRow; onContinue?: (id: string) => void }): ReactElement {
  const whatsapp = whatsAppVm(row);
  return <TableCell onClick={event => event.stopPropagation()}>
    <div className="flex items-center justify-end gap-1">
      {row.registrationPending && onContinue && <Button size="icon-sm" variant="ghost" title="Continuar cadastro"
        aria-label={`Continuar cadastro de ${row.fullName}`} onClick={() => onContinue(row.id)}><ClipboardList aria-hidden="true" /></Button>}
      {whatsapp && <Button nativeButton={false} render={<a aria-label={whatsapp.label} href={whatsapp.url} rel="noreferrer" target="_blank" />}
        size="icon-sm" variant="ghost"><MessageCircle aria-hidden="true" /></Button>}
    </div>
  </TableCell>;
}

export function StudentsTableRow({
  row,
  onOpen,
  onContinue,
}: {
  row: StudentListRow;
  onOpen: (id: string) => void;
  onContinue?: (id: string) => void;
}): ReactElement {
  return (
    <TableRow
      className="cursor-pointer focus-visible:outline-none focus-visible:shadow-focus"
      onClick={() => onOpen(row.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) onOpen(row.id);
      }}
      tabIndex={0}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar colorKey={row.id} name={row.fullName} size="sm" />
          <span className="font-medium text-foreground">{row.fullName}</span>
          {row.isMinor ? <Badge variant="neutral">menor</Badge> : null}
        </div>
      </TableCell>
      <EnrollmentCell enrollment={row.enrollment} />
      <TableCell>{row.enrollment?.teacherName ?? EM_DASH}</TableCell>
      <FactCell vm={attendanceCellVm(row.attendance)} />
      <FactCell vm={financeCellVm(row.finance)} />
      <StudentActions row={row} onContinue={onContinue} />
    </TableRow>
  );
}

function StatesRow({
  state,
  onRetry,
  pageSize,
}: {
  state: StudentsTableState;
  onRetry: () => void;
  pageSize: number;
}): ReactNode {
  if (state.kind === "loading") {
    return (
      <TableSkeleton columns={COLUMN_COUNT} numericColumns={NUMERIC_COLUMNS} rows={pageSize} />
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
  onOpenRow,
  onContinue,
  pagination,
}: {
  state: StudentsTableState;
  onRetry: () => void;
  onOpenRow: (id: string) => void;
  onContinue?: (id: string) => void;
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
            <TableHead className="w-24 text-center">
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {state.kind === "data" ? (
            state.rows.map((row) => <StudentsTableRow key={row.id} onOpen={onOpenRow} onContinue={onContinue} row={row} />)
          ) : (
            <StatesRow onRetry={onRetry} state={state} pageSize={pagination.pageSize} />
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
