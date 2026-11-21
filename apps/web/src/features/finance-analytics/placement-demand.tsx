import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { AnalyticsFilters } from "./analytics-filters";
import { QueryNotice } from "./query-notice";
import styles from "./operations.module.css";
import type { ReactElement } from "react";

export function PlacementDemand(): ReactElement {
  const query = trpc.dashboard.placementDemand.useQuery();
  const [onlyWaiting, setOnlyWaiting] = useState(false);
  const rows = query.data?.filter((row) => !onlyWaiting || row.waiting > 0);
  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>Espera e vagas por estágio</h2>
          <p>Posição atual · interessados aguardando alocação e vagas nas turmas em andamento.</p>
        </div>
        <AnalyticsFilters label={onlyWaiting ? "Com espera" : "Filtros"}>
          <label>
            <input
              type="checkbox"
              checked={onlyWaiting}
              onChange={(event) => setOnlyWaiting(event.target.checked)}
            />{" "}
            Só estágios com espera
          </label>
        </AnalyticsFilters>
      </header>
      {rows ? (
        rows.length > 0 ? (
          <div className={styles.scroll}>
            <table>
              <thead>
                <tr>
                  <th>Estágio</th>
                  <th>Formato</th>
                  <th>Em espera</th>
                  <th>Vagas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.stage + "-" + row.format}>
                    <th>{row.stage}</th>
                    <td>{formatLabels[row.format ?? ""] ?? "A definir"}</td>
                    <td className={row.waiting ? styles.warning : undefined}>{row.waiting}</td>
                    <td>{row.seats}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Sem vagas ou interessados neste recorte.</p>
        )
      ) : (
        <QueryNotice failed={query.isError} retry={() => void query.refetch()} />
      )}
    </section>
  );
}

const formatLabels: Record<string, string> = { ONLINE: "Online", IN_PERSON: "Presencial" };
