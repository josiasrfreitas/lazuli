import { StudentAvatar } from "~/components/student-avatar";
import type { ReactElement } from "react";
import Link from "next/link";
import {
  Badge,
  DataTable,
  type DataTableColumn,
  type DataTableState,
  type TablePaginationConfig,
} from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { formatAttendancePercent, toWhatsAppUrl } from "~/lib/format";
import { gradeLabel } from "~/features/assessments/shared";
import { rosterStatus, type RosterRow } from "./roster-status";
import { StudentScore, StudentScores } from "~/features/students/student-score";
import { studentAgeLabel } from "./student-age";
import { formatTrackName } from "./labels";
import { StudentAssessmentsDialog } from "~/features/students/profile/student-assessments-dialog";
import { AttendanceHistoryDialog } from "~/features/students/profile/attendance-history-dialog";
import { StudentActions } from "./roster-actions";

type List = RouterOutputs["classes"]["roster"];
type Props = {
  data: List | undefined;
  failed: boolean;
  refetch: () => void;
  page: number;
  setPage: (page: number) => void;
  close: (row: RosterRow) => void;
  resume?: ((row: RosterRow) => void) | undefined;
  showStage: boolean;
  filtered?: boolean;
  condensed?: boolean;
};
const PAGE_SIZE = 25;
const TONES = {
  Vigente: "success",
  Programada: "info",
  Pausada: "warning",
  Encerrada: "neutral",
  "Aguardando execução": "warning",
} as const;
export function RosterList(props: Props): ReactElement {
  return (
    <StudentScores ids={props.data?.rows.map((row) => row.studentId) ?? []}>
      <DataTable
        label="Alunos da turma"
        columns={rosterColumns(props)}
        state={rosterState(props)}
        onRetry={props.refetch}
        errorTitle="Não foi possível carregar os alunos"
        empty={{
          title: "Nenhum vínculo encontrado",
          description: "Matricule um aluno para começar esta turma.",
        }}
        pagination={rosterPagination(props)}
      />
    </StudentScores>
  );
}
function rosterState(props: Props): DataTableState<RosterRow> {
  if (props.failed) return { kind: "error" };
  if (!props.data) return { kind: "loading" };
  if (props.data.rows.length === 0) return { kind: props.filtered ? "noResults" : "empty" };
  return { kind: "data", rows: props.data.rows };
}
function rosterPagination(props: Props): TablePaginationConfig {
  const base = {
    page: props.page,
    pageSize: PAGE_SIZE,
    onPageChange: props.setPage,
    itemLabel: { singular: "aluno", plural: "alunos" },
  };
  return props.data
    ? { ...base, pageCount: props.data.pageCount, totalItems: props.data.total }
    : { ...base, loading: true };
}
function rosterColumns(props: Props): DataTableColumn<RosterRow>[] {
  const today = props.data?.today ?? "";
  const columns: DataTableColumn<RosterRow>[] = [
    {
      id: "student",
      header: props.condensed && props.showStage ? "Aluno / estágio" : "Aluno",
      width: props.condensed ? "medium" : "wide",
      cell: (row) => (
        <StudentIdentity
          row={row}
          today={today}
          condensed={props.condensed ?? false}
          showStage={props.showStage}
        />
      ),
    },
  ];
  if (!props.condensed)
    columns.push({
      id: "contact",
      header: "Contato",
      width: "medium",
      cell: (row) => <StudentContact row={row} />,
    });
  if (props.showStage && !props.condensed)
    columns.push({
      id: "stage",
      header: "Estágio / trilha",
      width: "medium",
      cell: (row) => <StudentLearningContext row={row} />,
    });
  columns.push(...rosterMetricColumns());
  if (!props.condensed)
    columns.push({
      id: "membership",
      header: "Vínculo",
      width: "medium",
      cell: (row) => <StudentMembership row={row} today={today} />,
    });
  return [...columns, rosterActionsColumn(props, today)];
}
function rosterActionsColumn(props: Props, today: string): DataTableColumn<RosterRow> {
  return {
    id: "actions",
    header: <span className="sr-only">Ações</span>,
    width: "actions",
    cell: (row) => (
      <StudentActions
        row={row}
        close={props.close}
        canClose={rosterStatus(row, today) === "Vigente"}
        resume={
          rosterStatus(row, today) === "Pausada" && row.returnActions.length === 0
            ? props.resume
            : undefined
        }
      />
    ),
  };
}
function rosterMetricColumns(): DataTableColumn<RosterRow>[] {
  return [
    {
      id: "score",
      header: "Score",
      numeric: true,
      width: "narrow",
      cell: (row) => <StudentScore studentId={row.studentId} />,
    },
    {
      id: "gradeAverage",
      header: "Média",
      numeric: true,
      width: "narrow",
      cell: (row) => (
        <StudentAssessmentsDialog
          studentId={row.studentId}
          studentName={row.student.fullName}
          triggerLabel="Ver notas"
          triggerValue={gradeLabel(row.gradeAverage)}
        />
      ),
    },
    {
      id: "attendance",
      header: "Frequência",
      numeric: true,
      width: "narrow",
      cell: (row) => (
        <AttendanceHistoryDialog
          studentId={row.studentId}
          studentName={row.student.fullName}
          enrollmentId={row.id}
          triggerLabel="Ver frequência"
          triggerValue={formatAttendancePercent(row.attendancePercent)}
        />
      ),
    },
  ];
}
function StudentIdentity({
  row,
  today,
  condensed,
  showStage,
}: {
  row: RosterRow;
  today: string;
  condensed: boolean;
  showStage: boolean;
}): ReactElement {
  const status = rosterStatus(row, today) as keyof typeof TONES;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <StudentAvatar name={row.student.fullName} colorKey={row.studentId} size="md" />
      <div className="grid min-w-0 gap-1">
        <Link
          className="truncate font-medium text-interactive hover:underline"
          href={`/alunos/${row.studentId}`}
          title={row.student.fullName}
        >
          {row.student.fullName}
        </Link>
        {!condensed && (
          <span className="text-caption text-muted-foreground">
            {studentAgeLabel(row.student.birthDate, today)}
          </span>
        )}
        {condensed && showStage && (
          <span className="truncate text-caption text-muted-foreground">
            {row.progressRecords[0]?.stage.name ?? "Estágio não informado"}
          </span>
        )}
        {condensed && status !== "Vigente" && (
          <span>
            <Badge variant={TONES[status]}>{status}</Badge>
          </span>
        )}
      </div>
    </div>
  );
}
function StudentContact({ row }: { row: RosterRow }): ReactElement {
  const whatsapp = toWhatsAppUrl(row.student.phone);
  return (
    <div className="font-numeric text-caption tabular-nums">
      {whatsapp ? (
        <a
          className="text-interactive hover:underline focus-visible:underline"
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          aria-label={`Abrir WhatsApp de ${row.student.fullName}: ${row.student.phone}`}
        >
          {row.student.phone}
        </a>
      ) : (
        <span>{row.student.phone ?? "Sem telefone"}</span>
      )}
    </div>
  );
}
function StudentLearningContext({ row }: { row: RosterRow }): ReactElement {
  const stage = row.progressRecords[0]?.stage;
  return (
    <div className="grid gap-1">
      <span>{stage?.name ?? "Estágio não informado"}</span>
      <span className="text-caption text-muted-foreground">
        {stage ? formatTrackName(stage.track.name) : "Trilha não informada"}
      </span>
    </div>
  );
}
function StudentMembership({ row, today }: { row: RosterRow; today: string }): ReactElement {
  const status = rosterStatus(row, today) as keyof typeof TONES;
  return (
    <div className="grid justify-items-start gap-1">
      {status !== "Vigente" && <Badge variant={TONES[status]}>{status}</Badge>}
      <span className="text-caption text-muted-foreground">
        Desde {row.entryDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
      </span>
      {row.exitDate && (
        <span className="text-caption text-muted-foreground">
          Até {row.exitDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
        </span>
      )}
    </div>
  );
}
