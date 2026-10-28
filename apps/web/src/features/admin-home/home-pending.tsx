import type { ReactElement } from "react";
import { Inbox } from "lucide-react";
import type { BusinessData } from "./home-metrics";
import type { HomeData } from "./home-parts";
import { PendingRenewals } from "./home-pending-renewals";
import { PendingFinance } from "./home-pending-finance";
import { trpc } from "~/lib/trpc";
import { PendingAppointments } from "./home-pending-appointments";
import { PendingPlacement } from "./home-pending-placement";
import { PendingLessons } from "./home-pending-lessons";
import { PendingCoverage } from "./home-pending-coverage";
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
            <PendingCoverage group={group} />
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
            {!group?.total &&
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
