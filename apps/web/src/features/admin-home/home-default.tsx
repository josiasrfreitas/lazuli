import { useEffect, useRef, type ReactElement } from "react";
import { HomeError, type HomeAction, type HomeData } from "./home-parts";
import { HomePending } from "./home-pending";
import { HomeAudience, HomeSummary, HomeSummaryLoading } from "./home-summary";
import type { BusinessData } from "./home-metrics";
import styles from "./home-default.module.css";

type HomeDefaultProps = {
  name: string;
  data: HomeData | undefined;
  business: BusinessData | undefined;
  businessLoading: boolean;
  businessError: boolean;
  loading: boolean;
  error: boolean;
  retry: () => void;
};

export function homeActionHref(action: HomeAction): string {
  if (action.kind === "link") return action.href;
  if (action.kind === "lesson") return `/aulas/${action.id}`;
  return `/atendimentos/${action.id}`;
}

export function HomeDefault({
  name,
  data,
  business,
  businessLoading,
  businessError,
  loading,
  error,
  retry,
}: HomeDefaultProps): ReactElement {
  const workspace = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = workspace.current;
    if (!root) return;
    const measure = (): void => {
      const available = Math.max(480, window.innerHeight - root.getBoundingClientRect().top - 20);
      root.style.setProperty("--workspace-height", `${available}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root.parentElement ?? root);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  const summaryLoading = loading || Boolean(data?.canViewFinance && !business && !businessError);
  const firstName = name.trim().split(/\s+/u)[0];

  return (
    <div className={styles.page} data-home-content>
      <header className={styles.welcome}>
        <h1>
          {firstName ? (
            <>
              Olá, <span className={styles.personName}>{firstName}</span>.
            </>
          ) : (
            "Olá."
          )}
        </h1>
        <p>O que precisa da sua atenção hoje.</p>
      </header>

      {error && (
        <HomeError retry={retry}>
          {data
            ? "Não foi possível atualizar o Início. Os dados exibidos podem estar desatualizados."
            : "Não foi possível carregar o Início."}
        </HomeError>
      )}

      <div ref={workspace} className={styles.workspace}>
        <div className={styles.metrics}>
          {summaryLoading ? (
            <HomeSummaryLoading />
          ) : data ? (
            <HomeSummary data={data} business={business} businessError={businessError} />
          ) : null}
        </div>
        {(data || loading) && (
          <HomePending
            data={data}
            business={business}
            loading={loading}
            businessLoading={businessLoading}
            businessError={businessError}
          />
        )}
        <div className={styles.audience} data-home-audience>
          {summaryLoading ? (
            <HomeSummaryLoading audience />
          ) : data ? (
            <HomeAudience data={data} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
