import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatAttendancePercent } from "~/lib/format";
import { AttendanceTrend } from "../finance-analytics/attendance-trend";
import { QueryNotice } from "../finance-analytics/query-notice";
import styles from "../finance-analytics/operations.module.css";
import type { ReactElement } from "react";

export function HomeAttendance(): ReactElement {
  const query = trpc.teacherWorkspace.weeklyAttendance.useQuery({ days: 30 });
  const present = query.data?.reduce((count, row) => count + row.present, 0) ?? 0;
  const marked = query.data?.reduce((count, row) => count + row.marked, 0) ?? 0;
  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>Frequência dos meus alunos</h2>
          <p>Chamadas confirmadas nos últimos 30 dias</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          nativeButton={false}
          render={<Link href="/professor/analytics" />}
        >
          Ver analytics <ArrowUpRight aria-hidden="true" />
        </Button>
      </header>
      {query.data ? (
        <>
          {marked > 0 && (
            <div className="text-sm">
              <strong className="text-xl text-info">
                {formatAttendancePercent(present / marked)}
              </strong>{" "}
              · {present} de {marked} presenças possíveis
            </div>
          )}
          <AttendanceTrend rows={query.data} group="" />
        </>
      ) : (
        <QueryNotice failed={query.isError} retry={() => void query.refetch()} />
      )}
    </section>
  );
}
