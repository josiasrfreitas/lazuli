import { useEffect, useRef, type ReactElement, type RefObject } from "react";
import { HomeError, type HomeAction, type HomeData } from "./home-parts";
import { HomePending } from "./home-pending";
import { HomeAudience, HomeSummary, HomeSummaryLoading } from "./home-summary";
import type { BusinessData } from "./home-metrics";
import type { InitialDashboardData } from "./home";
import styles from "./home-default.module.css";

type HomeDefaultProps = {
  name: string;
  data: HomeData | undefined;
  business: BusinessData | undefined;
  businessLoading: boolean;
  businessError: boolean;
  initialLessons?: InitialDashboardData["pendingLessons"];
  loading: boolean;
  error: boolean;
  retry: () => void;
};

const MIN_WORKSPACE_HEIGHT = 480;
const WORKSPACE_BOTTOM_GAP = 20;

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
  initialLessons,
  loading,
  error,
  retry,
}: HomeDefaultProps): ReactElement {
  const workspace = useWorkspaceHeight();
  const summaryLoading = loading || Boolean(data?.canViewFinance && !business && !businessError);
  return (
    <div className={styles.page} data-home-content>
      <HomeGreeting name={name} />

      {error && (
        <HomeError retry={retry}>
          {data
            ? "Não foi possível atualizar o Início. Os dados exibidos podem estar desatualizados."
            : "Não foi possível carregar o Início."}
        </HomeError>
      )}

      <div ref={workspace} className={styles.workspace}>
        <HomeMetrics
          data={data}
          business={business}
          businessError={businessError}
          loading={summaryLoading}
        />
        {(data || loading) && (
          <HomePending
            data={data}
            business={business}
            loading={loading}
            businessLoading={businessLoading}
            businessError={businessError}
            initialLessons={initialLessons}
          />
        )}
        <HomeAudiencePanel data={data} loading={summaryLoading} />
      </div>
    </div>
  );
}

function HomeGreeting({ name }: { name: string }): ReactElement {
  const firstName = name.trim().split(/\s+/u)[0];
  return (
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
  );
}

function useWorkspaceHeight(): RefObject<HTMLDivElement | null> {
  const workspace = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = workspace.current;
    if (!root) return;
    const measure = (): void => {
      const available = Math.max(
        MIN_WORKSPACE_HEIGHT,
        globalThis.innerHeight - root.getBoundingClientRect().top - WORKSPACE_BOTTOM_GAP,
      );
      root.style.setProperty("--workspace-height", `${available}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root.parentElement ?? root);
    globalThis.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      globalThis.removeEventListener("resize", measure);
    };
  }, []);
  return workspace;
}

function HomeMetrics({
  data,
  business,
  businessError,
  loading,
}: {
  data: HomeData | undefined;
  business: BusinessData | undefined;
  businessError: boolean;
  loading: boolean;
}): ReactElement {
  let content: ReactElement | null = null;
  if (loading) content = <HomeSummaryLoading />;
  else if (data)
    content = <HomeSummary data={data} business={business} businessError={businessError} />;
  return <div className={styles.metrics}>{content}</div>;
}

function HomeAudiencePanel({
  data,
  loading,
}: {
  data: HomeData | undefined;
  loading: boolean;
}): ReactElement {
  let content: ReactElement | null = null;
  if (loading) content = <HomeSummaryLoading audience />;
  else if (data) content = <HomeAudience data={data} />;
  return (
    <div className={styles.audience} data-home-audience>
      {content}
    </div>
  );
}
