import type { ReactElement } from "react";
import Link from "next/link";
import { Badge, DataTable, type DataTableColumn } from "@lazuli/ui";
import { formatAttendancePercent, formatDateOnlyBR } from "~/lib/format";
import type { StudentEnrollment } from "./logic";
const EXIT_LABELS = {
  COMPLETED: "Concluída",
  TRANSFERRED: "Transferência",
  DROPPED: "Encerrada",
  SUSPENDED: "Pausada",
  CORRECTION: "Correção",
};
function historyColumns(today: string): DataTableColumn<StudentEnrollment>[] {
  return [
    {
      id: "class",
      header: "Turma / semestre",
      width: "wide",
      cell: (row) => <HistoryClass row={row} />,
    },
    {
      id: "period",
      header: "Período",
      width: "medium",
      cell: (row) => (
        <div className="grid gap-1">
          <span>{formatDateOnlyBR(row.entryDate)}</span>
          <span className="text-caption text-muted-foreground">
            {row.exitDate ? `até ${formatDateOnlyBR(row.exitDate)}` : "Sem saída definida"}
          </span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Situação",
      width: "standard",
      cell: (row) => (
        <Badge variant="neutral">
          {row.entryDate > today
            ? "Agendada"
            : row.exitReason
              ? EXIT_LABELS[row.exitReason]
              : "Encerrada"}
        </Badge>
      ),
    },
    {
      id: "attendance",
      header: "Frequência",
      numeric: true,
      width: "narrow",
      cell: (row) => formatAttendancePercent(row.attendance.percent),
    },
  ];
}
export function EnrollmentHistory({
  rows,
  today,
}: {
  rows: StudentEnrollment[];
  today: string;
}): ReactElement {
  return (
    <section className="grid min-w-0 gap-3">
      <h2 className="text-base font-semibold">Histórico de matrículas</h2>
      <DataTable
        label="Histórico de matrículas do aluno"
        columns={historyColumns(today)}
        state={rows.length ? { kind: "data", rows } : { kind: "empty" }}
        onRetry={() => undefined}
        empty={{
          title: "Sem outras matrículas",
          description: "Matrículas anteriores e entradas agendadas aparecem aqui.",
        }}
        errorTitle="Não foi possível carregar o histórico"
      />
    </section>
  );
}

function HistoryClass({ row }: { row: StudentEnrollment }): ReactElement {
  return (
    <div className="grid gap-1">
      <Link
        className="font-medium text-interactive hover:underline"
        href={`/turmas/${row.class.id}`}
      >
        {row.class.name}
      </Link>
      <span className="text-caption text-muted-foreground">{row.class.semester}</span>
    </div>
  );
}
