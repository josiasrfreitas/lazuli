import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowRight, UsersRound, Inbox } from "lucide-react";
import type { BusinessData } from "./home-metrics";
import type { HomeData } from "./home-parts";
import { PendingRenewals } from "./home-pending-renewals";
import { PendingFinance } from "./home-pending-finance";
import { trpc } from "~/lib/trpc";
import { PendingAppointments } from "./home-pending-appointments";
import { PendingPlacement } from "./home-pending-placement";
import { PendingLessons } from "./home-pending-lessons";
import styles from "./home-pending.module.css";

export function HomePending({
  data,
  business,
  loading,
  businessError,
}: {
  data: HomeData | undefined;
  business: BusinessData | undefined;
  loading: boolean;
  businessLoading: boolean;
  businessError: boolean;
}): ReactElement {
  const lessons = trpc.dashboard.pendingLessons.useQuery(undefined, { refetchInterval: 60_000 });
  const hasFinance = Boolean(data?.canViewFinance && business && business.overdueCents > 0);
  const group = data?.groups.find((group) => group.kind === "coverage");
  const items = group?.items ?? [];
  const appointments = data?.groups.find((group) => group.kind === "appointments");
  const renewals = data?.canViewFinance
    ? data.groups.find((group) => group.kind === "renewals")
    : undefined;
  const placement = data?.groups.find((group) => group.kind === "placement");
  return (
    <section className={styles.pending} aria-labelledby="home-pending-title">
      <header className={styles.heading}>
        <h2 id="home-pending-title">Pendências</h2>
      </header>
      <div className={styles.scrollport}>
        <table className={styles.table} aria-label="Pendências">
          <tbody>
            {hasFinance && business && <PendingFinance business={business} />}
            {items.map((item) =>
              item.action.kind === "link" ? (
                <tr key={item.id}>
                  <td className={styles.cell}>
                    <Link className={styles.item} href={item.action.href}>
                      <span className={styles.icon}>
                        <UsersRound aria-hidden="true" />
                      </span>
                      <span className={styles.identity}>
                        <strong className={styles.title}>
                          Turma sem professor <span>· {item.stageName ?? item.title}</span>
                          {item.studentCount !== undefined && (
                            <span className={styles.fact}>
                              {item.studentCount} {item.studentCount === 1 ? "aluno" : "alunos"}
                            </span>
                          )}
                        </strong>
                        <span className={styles.context}>
                          <span>{item.detail}</span>
                          {item.departedTeacherName && <span>{item.departedTeacherName} saiu</span>}
                        </span>
                      </span>
                      {item.timing?.kind === "meeting" && (
                        <span className={styles.when}>
                          Próxima aula ·{" "}
                          {item.timing.date.split("-").toReversed().slice(0, 2).join("/")} às{" "}
                          {item.timing.startTime}
                        </span>
                      )}
                      <span className={styles.action}>
                        Definir professor <ArrowRight aria-hidden="true" />
                      </span>
                    </Link>
                  </td>
                </tr>
              ) : null,
            )}
            {data?.canViewFinance && <PendingRenewals group={renewals} today={data.today} />}
            <PendingAppointments group={appointments} today={data?.today ?? ""} />
            <PendingPlacement group={placement} today={data?.today ?? ""} />
            <PendingLessons teachers={lessons.data ?? []} />
            {lessons.isPending && (
              <tr>
                <td className={styles.feedback} role="status">
                  Carregando aulas sem registro…
                </td>
              </tr>
            )}
            {lessons.isError && (
              <tr>
                <td className={styles.feedback}>
                  Não foi possível atualizar as aulas sem registro.{" "}
                  <button
                    type="button"
                    onClick={() => {
                      void lessons.refetch();
                    }}
                  >
                    Tentar novamente
                  </button>
                </td>
              </tr>
            )}
            {items.length === 0 &&
              !hasFinance &&
              !placement?.total &&
              !renewals?.total &&
              !appointments?.total &&
              !appointments?.historyTotal &&
              lessons.isSuccess &&
              lessons.data.length === 0 && (
                <tr>
                  <td className={styles.empty}>
                    <Inbox aria-hidden="true" />
                    <p>{loading ? "Carregando pendências…" : "Nenhuma pendência neste período."}</p>
                  </td>
                </tr>
              )}
            {businessError && data?.canViewFinance && (
              <tr>
                <td className={styles.feedback}>Financeiro indisponível no momento.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
