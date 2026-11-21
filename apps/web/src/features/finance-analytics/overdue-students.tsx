import type { RouterOutputs } from "@lazuli/api";
import { AnalyticsRecords } from "./analytics-records";
import Link from "next/link";
import { trpc } from "~/lib/trpc";
import { formatAttendancePercent, formatBRLFromCents, formatDateOnlyBR } from "~/lib/format";
import { QueryNotice } from "./query-notice";
import styles from "./operations.module.css";
import type { ReactElement } from "react";

const statusLabels = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  DROPPED: "Desistente",
  SUSPENDED: "Trancado",
};
export function OverdueStudents(): ReactElement {
  const query = trpc.dashboard.overdueStudents.useQuery();
  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>Alunos com contrato em atraso</h2>
          <p>
            Saldo vencido hoje, frequência nos últimos 30 dias e último aviso automático das
            parcelas em aberto.
          </p>
        </div>
        <Link
          className="text-sm text-interactive hover:underline"
          href="/recebiveis?status=vencidas"
        >
          Abrir recebíveis
        </Link>
      </header>
      {query.data ? (
        query.data.length > 0 ? (
          <OverdueTable rows={query.data} />
        ) : (
          <p>Nenhum aluno com contrato em atraso.</p>
        )
      ) : (
        <QueryNotice failed={query.isError} retry={() => void query.refetch()} />
      )}
    </section>
  );
}

function OverdueTable({
  rows,
}: {
  rows: RouterOutputs["dashboard"]["overdueStudents"];
}): ReactElement {
  return (
    <AnalyticsRecords
      rows={rows}
      label="Alunos com contrato em atraso"
      columns={[
        {
          id: "name",
          header: "Aluno",
          width: "wide",
          cell: (row) => (
            <Link
              className="text-interactive hover:underline"
              href={`/alunos/${row.id}?secao=financeiro`}
            >
              {row.name}
            </Link>
          ),
        },
        { id: "status", header: "Situação", cell: (row) => statusLabels[row.status] },
        {
          id: "balance",
          header: "Saldo vencido",
          numeric: true,
          cell: (row) => formatBRLFromCents(row.balance),
        },
        {
          id: "days",
          header: "Maior atraso",
          numeric: true,
          cell: (row) => <span className={styles.warning}>{row.days} dias</span>,
        },
        {
          id: "attendance",
          header: "Frequência",
          numeric: true,
          cell: (row) => formatAttendancePercent(row.attendance),
        },
        {
          id: "score",
          header: "Health score",
          numeric: true,
          cell: (row) => row.score ?? "—",
        },
        {
          id: "notice",
          header: "Último aviso",
          cell: (row) => (row.lastNotice ? formatDateOnlyBR(row.lastNotice) : "—"),
        },
      ]}
    />
  );
}
