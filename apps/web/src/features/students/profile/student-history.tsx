import type { ReactElement } from "react";
import { Badge, DataTable, type DataTableColumn } from "@lazuli/ui";
import { formatAttendancePercent, formatDateOnlyBR } from "~/lib/format";
import type { StudentEnrollment } from "./logic";
import { EnrollmentSchedule, ProgressJourney } from "./current-enrollment";

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
      header: "Turma e percurso",
      width: "wide",
      cell: (row) => (
        <div className="grid gap-2">
          <EnrollmentSchedule enrollment={row} />
          <p className="text-caption text-muted-foreground">{row.class.semester}</p>
          {row.progress.length > 0 && <ProgressJourney enrollment={row} />}
        </div>
      ),
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
      cell: (row) => <Badge variant="neutral">{historyStatus(row, today)}</Badge>,
    },
    {
      id: "attendance",
      header: "Frequência",
      width: "narrow",
      numeric: true,
      cell: (row) => formatAttendancePercent(row.attendance.percent),
    },
  ];
}

function historyStatus(row: StudentEnrollment, today: string): string {
  if (row.entryDate > today) return "Agendada";
  return row.exitReason ? EXIT_LABELS[row.exitReason] : "Encerrada";
}

export function EnrollmentHistory({
  rows,
  today,
  onRetry,
}: {
  rows: StudentEnrollment[];
  today: string;
  onRetry: () => void;
}): ReactElement | null {
  if (rows.length === 0) return null;
  return (
    <section className="grid min-w-0 gap-3" aria-labelledby="enrollment-history">
      <div>
        <h2 id="enrollment-history" className="font-display text-xl font-semibold text-heading">
          Outras matrículas
        </h2>
        <p className="text-caption text-muted-foreground">
          Matrículas anteriores e entradas agendadas
        </p>
      </div>
      <DataTable
        label="Histórico de matrículas do aluno"
        columns={historyColumns(today)}
        state={{ kind: "data", rows }}
        onRetry={onRetry}
        empty={{
          title: "Sem outras matrículas",
          description: "Matrículas anteriores e entradas agendadas aparecem aqui.",
        }}
        errorTitle="Não foi possível carregar o histórico"
      />
    </section>
  );
}
