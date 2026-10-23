import type { ReactElement } from "react";
import { JOURNEY } from "./home-model";
import styles from "./home.module.css";

export function LoadingLine({ size = "body" }: { size?: "number" | "title" | "body" | "short" }): ReactElement {
  return <span aria-hidden="true" className={styles.placeholder} data-size={size} />;
}
export function BusinessLoading(): ReactElement {
  return (
    <div className={styles.businessGrid} aria-hidden="true">
      <div className={styles.businessNumbers}>
        {["cash", "agreements", "overdue"].map(key => (
          <div key={key}><LoadingLine size="short" /><LoadingLine size="number" /><LoadingLine /></div>
        ))}
      </div>
      <div className={styles.chartSkeleton}>
        <LoadingLine size="title" />
        <div className={styles.chartSkeletonPlot}>
          <div /><div /><div /><div />
        </div>
        <div className={styles.chartSkeletonMonths}>{["a", "b", "c", "d", "e", "f"].map(key => <LoadingLine key={key} size="short" />)}</div>
      </div>
    </div>
  );
}
export function HomeLoading({ finance }: { finance: boolean }): ReactElement {
  return (
    <div role="status" aria-label="Preparando a visão da escola" className={styles.loadingLayout}>
      <span className="sr-only">Carregando agenda e próximos passos.</span>
      <div className={styles.workOverview} aria-hidden="true">
        <section className={styles.journey}>
          <div className={styles.sectionHeading}><h2>A jornada dos alunos</h2><span>Da chegada à renovação</span></div>
          <div className={styles.journeyTrack}>
            {JOURNEY.filter(stage => finance || stage.key !== "continuity").map(stage => (
              <div className={styles.journeyStage} key={stage.key}>
                <h3>{stage.title}</h3>
                <div className={styles.journeyActions}>
                  {stage.labels.map(label => <div className={styles.journeyCell} key={label}><div className={styles.journeyAction}><span>{label}</span><LoadingLine size="number" /></div><LoadingLine size="short" /></div>)}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className={styles.teaching}>
          <div className={styles.sectionHeading}><h2>Acompanhamento das aulas</h2><LoadingLine size="short" /></div>
          <div className={styles.recordQuiet}><LoadingLine /></div>
          <div className={styles.historyLinks}><LoadingLine size="short" /><LoadingLine size="short" /></div>
        </section>
      </div>
    </div>
  );
}
