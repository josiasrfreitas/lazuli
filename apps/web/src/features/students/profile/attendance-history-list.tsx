import type { ReactElement } from "react";
import { Check, X, CircleDashed, Ban } from "lucide-react";
import { Badge, Button, Pagination } from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import type { AttendanceHistory } from "./attendance-history-columns";
import styles from "./attendance-history-list.module.css";
import { AttendanceHistoryLoading } from "./attendance-history-loading";

type AttendanceRow = AttendanceHistory["rows"][number];
const DAY = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});
const STATUS = {
  PRESENT: { label: "Presença", variant: "success", icon: Check },
  ABSENT: { label: "Falta", variant: "warning", icon: X },
  PENDING: { label: "Chamada pendente", variant: "neutral", icon: CircleDashed },
  CANCELLED: { label: "Aula cancelada", variant: "neutral", icon: Ban },
} as const;

export function AttendanceHistoryList({
  data,
  error,
  fetching,
  status,
  onPageChange,
  onRetry,
}: {
  data: AttendanceHistory | undefined;
  error: boolean;
  fetching: boolean;
  status: keyof AttendanceHistory["counts"];
  onPageChange: (page: number) => void;
  onRetry: () => void;
}): ReactElement {
  if (error)
    return (
      <div role="alert" className="grid justify-items-start gap-3 py-6">
        <p>Não foi possível carregar a frequência.</p>
        <Button variant="secondary" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    );
  if (!data) return <AttendanceHistoryLoading />;
  return (
    <section aria-label="Aulas e presenças do aluno" aria-busy={fetching} className="min-w-0">
      {data.rows.length ? (
        <ol className={styles.list}>
          {data.rows.map((row) => (
            <AttendanceLesson key={row.sessionId} row={row} />
          ))}
        </ol>
      ) : (
        <p role="status" className="py-8 text-sm text-muted-foreground">
          {status === "ALL" ? "Nenhuma aula neste período." : "Nenhuma aula com esta situação."}
        </p>
      )}
      <footer className={styles.footer}>
        <span>
          {data.totalItems} {data.totalItems === 1 ? "aula" : "aulas"}
        </span>
        {data.pageCount > 1 && (
          <Pagination page={data.page} pageCount={data.pageCount} onPageChange={onPageChange} />
        )}
      </footer>
    </section>
  );
}

function AttendanceLesson({ row }: { row: AttendanceRow }): ReactElement {
  const StatusIcon = STATUS[row.status].icon;
  return (
    <li className={styles.lesson}>
      <div className={styles.date}>
        <StatusIcon aria-hidden="true" className={styles.statusIcon} data-status={row.status} />
        <time dateTime={row.date} title={formatDateOnlyBR(row.date)}>
          {DAY.format(new Date(row.date))}
        </time>
      </div>
      <span className={styles.hours}>
        {row.startTime}–{row.endTime}
      </span>
      <div className={styles.status}>
        <Badge variant={STATUS[row.status].variant}>
          {row.status === "PENDING" && row.confirmed ? "Sem registro" : STATUS[row.status].label}
        </Badge>
        {row.compensatedMinutes > 0 && (
          <span className={styles.compensation}>
            {row.compensatedMinutes === row.minutes ? "Falta reposta" : "Reposição parcial"}
            {` · ${row.compensatedMinutes}/${row.minutes} min`}
          </span>
        )}
      </div>
      {row.notes && <p className={styles.notes}>{row.notes}</p>}
    </li>
  );
}
