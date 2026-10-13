"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Button,
  DataTable,
  Input,
  TableFilters,
  type DataTableColumn,
  type TableFilterField,
} from "@lazuli/ui";
import { studentPaginationPolicy } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { tablePaginationPropsFor, useUrlPagination } from "~/lib/pagination";
import { formatDateOnlyBR } from "~/lib/format";
import { ScheduleAppointmentDialog } from "./schedule-dialog";
import { StudentInterventionForm } from "~/features/pedagogical-follow-up/student-intervention-form";
import type { Absence } from "./shared";

export function AbsenceList({ from, through }: { from: string; through: string }) {
  const [search, setSearch] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [action, setAction] = useState<{ kind: "schedule" | "intervention"; row: Absence } | null>(
    null,
  );
  const pagination = useUrlPagination(studentPaginationPolicy);
  const query = trpc.appointments.absences.useQuery({
    from,
    through,
    search,
    onlyOpen,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const filters: TableFilterField[] = [
    {
      id: "saldo",
      label: "Saldo",
      kind: "options",
      promoted: true,
      options: [{ id: "open", label: "Com minutos disponíveis" }],
      selected: onlyOpen ? ["open"] : [],
      onChange: (values) => {
        setOnlyOpen(values.includes("open"));
        pagination.setPage(1);
      },
      onClear: () => {
        setOnlyOpen(false);
        pagination.setPage(1);
      },
    },
  ];
  const columns: DataTableColumn<Absence>[] = [
    {
      id: "student",
      header: "Aluno / aula",
      width: "wide",
      cell: (row) => (
        <div className="grid gap-0.5">
          <Link href={`/alunos/${row.studentId}`} className="font-medium hover:underline">
            {row.studentName}
          </Link>
          <span className="text-caption text-muted-foreground">
            {formatDateOnlyBR(row.date)} · {row.className}
          </span>
        </div>
      ),
    },
    {
      id: "balance",
      header: "Reposição",
      width: "medium",
      cell: (row) => (
        <div className="grid gap-1">
          <span className="font-numeric font-medium tabular-nums">
            {row.available} min disponíveis
          </span>
          <span className="text-caption text-muted-foreground">
            {row.compensated} repostos · {row.reserved} agendados
          </span>
        </div>
      ),
    },
    {
      id: "actions",
      header: "Ações",
      width: "wide",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <Button
            variant="secondary"
            size="sm"
            disabled={row.available <= 0}
            onClick={() => setAction({ kind: "schedule", row })}
            aria-label={`Repor falta de ${row.studentName} em ${formatDateOnlyBR(row.date)}`}
          >
            Repor
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAction({ kind: "intervention", row })}
            aria-label={`Criar intervenção para ${row.studentName}`}
          >
            Criar intervenção
          </Button>
        </div>
      ),
    },
  ];
  return (
    <section className="grid min-w-0 grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-caption text-muted-foreground">
          {query.data ? `${query.data.total} faltas neste recorte` : "Carregando faltas"}
        </p>
        <div className="flex flex-wrap gap-2">
          <div className="w-56">
            <Input
              name="absence-search"
              aria-label="Buscar aluno nas faltas"
              placeholder="Buscar aluno"
              size="sm"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                pagination.setPage(1);
              }}
            />
          </div>
          <TableFilters
            fields={filters}
            onClearAll={() => {
              setOnlyOpen(false);
              pagination.setPage(1);
            }}
          />
        </div>
      </div>
      <div className="h-128 min-h-80 min-w-0">
        <DataTable
          label="Faltas e reposições"
          columns={columns}
          state={
            query.isError
              ? { kind: "error" }
              : !query.data
                ? { kind: "loading" }
                : query.data.rows.length
                  ? { kind: "data", rows: query.data.rows }
                  : { kind: "noResults" }
          }
          updating={query.isFetching}
          onRetry={() => void query.refetch()}
          empty={{
            title: "Nenhuma falta neste recorte",
            description: "Escolha outro período ou retire o filtro de saldo.",
          }}
          errorTitle="Não foi possível carregar as faltas"
          pagination={{
            ...tablePaginationPropsFor(pagination, query.data),
            itemLabel: { singular: "falta", plural: "faltas" },
          }}
        />
      </div>
      {action?.kind === "schedule" && (
        <ScheduleAppointmentDialog
          student={{ id: action.row.studentId, name: action.row.studentName }}
          source={action.row}
          onClose={() => setAction(null)}
        />
      )}
      {action?.kind === "intervention" && (
        <StudentInterventionForm
          student={{ id: action.row.studentId, name: action.row.studentName }}
          onClose={() => setAction(null)}
        />
      )}
    </section>
  );
}
