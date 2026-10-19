import type { ReactElement } from "react";
import Link from "next/link";
import { Badge, DataTable, type DataTableColumn } from "@lazuli/ui";
import { formatAttendancePercent, formatDateOnlyBR } from "~/lib/format";
import type { StudentEnrollment } from "./logic";
import { AttendanceHistoryDialog } from "./attendance-history-dialog";
const EXIT_LABELS = {
  COMPLETED: "Concluída",
  TRANSFERRED: "Transferência",
  DROPPED: "Encerrada",
  SUSPENDED: "Pausada",
  CORRECTION: "Correção",
};
function historyColumns(today: string, studentId: string): DataTableColumn<StudentEnrollment>[] {
  return [
    {
      id: "class",
      header: "Turma / semestre",
      width: "wide",
      cell: (row) => <HistoryClass row={row} studentId={studentId} />,
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
      numeric: true,
      width: "narrow",
      cell: (row) => formatAttendancePercent(row.attendance.percent),
    },
  ];
}
export function EnrollmentHistory({
  rows,
  today,
  studentId,
  studentName,
}: {
  rows: StudentEnrollment[];
  today: string;
  studentId: string;
  studentName: string;
}): ReactElement | null {
  if (rows.length === 0) return null;

  return (
    <section className="grid min-w-0 gap-3 border-t border-border pt-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <div className="mr-auto flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-xl font-semibold text-heading">Matrículas do Aluno</h2>
          <p className="text-caption text-muted-foreground">
            Matrículas anteriores e entradas agendadas
          </p>
        </div>
        <AttendanceHistoryDialog
          studentId={studentId}
          studentName={studentName}
          triggerLabel="Ver frequência"
        />
      </div>
      <DataTable
        label="Histórico de matrículas do aluno"
        columns={historyColumns(today, studentId)}
        state={{ kind: "data", rows }}
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

function HistoryClass({
  row,
  studentId,
}: {
  row: StudentEnrollment;
  studentId: string;
}): ReactElement {
  return (
    <div className="grid gap-1">
      <Link
        className="font-medium text-interactive hover:underline"
        href={`/turmas/${row.class.id}`}
      >
        {row.class.name}
      </Link>
      <span className="text-caption text-muted-foreground">{row.class.semester}</span>
      {row.class.scheduleType === "PERSONALIZED" ? (
        row.progress.toReversed().map((progress) => (
          <Link
            key={progress.id}
            className="text-caption text-interactive hover:underline"
            href={`/alunos/${studentId}?secao=planejamento&percurso=${progress.id}`}
          >
            Plano · {progress.stage}
          </Link>
        ))
      ) : (
        <Link
          className="text-caption text-interactive hover:underline"
          href={`/turmas/${row.class.id}?secao=planejamento`}
        >
          Planejamento da turma
        </Link>
      )}
    </div>
  );
}

function historyStatus(row: StudentEnrollment, today: string): string {
  if (row.entryDate > today) return "Agendada";
  return row.exitReason ? EXIT_LABELS[row.exitReason] : "Encerrada";
}
