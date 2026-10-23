import type { ReactElement } from "react";
import { Users, GraduationCap, CalendarCheck2 } from "lucide-react";
import styles from "./home.module.css";

export function LoadingLine({ size = "body" }: { size?: "number" | "title" | "body" | "short" }): ReactElement {
  return <span aria-hidden="true" className={styles.placeholder} data-size={size} />;
}
export function MetricsLoading(): ReactElement {
  const labels = ["Matrículas iniciadas", "Novos alunos", "Experimentais realizadas"];
  const icons = [GraduationCap, Users, CalendarCheck2];
  return <div className={styles.metrics} role="status" aria-label="Carregando indicadores da escola">{labels.map((label, index) => {
    const Icon = icons[index]!;
    return <div className={styles.metric} data-variant={index === 0 ? "lead" : undefined} key={label} aria-hidden="true">
      <div className={styles.metricHeading}><h2><Icon />{label}</h2></div>
      <div className={styles.metricValue}><LoadingLine size="number" /></div>
      <div className={styles.metricContext}><LoadingLine size="short" /></div>
      <div className={styles.metricBottom}><div><LoadingLine size="short" /><LoadingLine /></div><div className={styles.sparkPlaceholder} /></div>
    </div>;
  })}</div>;
}
export function ChartLoading(): ReactElement {
  return <section className={styles.chartPanel} role="status" aria-label="Carregando evolução da escola">
    <div className={styles.chartHeading}><div><h2>Entradas ao longo dos meses</h2><p className={styles.description}>Carregando os últimos meses</p></div></div>
    <div className={styles.chartLegend} aria-hidden="true"><LoadingLine size="short" /><LoadingLine size="short" /></div>
    <div className={styles.chartSkeletonPlot} aria-hidden="true"><div /><div /><div /><div /></div>
    <div className={styles.chartSkeletonMonths} aria-hidden="true">{[0,1,2,3,4,5].map(i => <LoadingLine key={i} size="short" />)}</div>
    <div className={styles.chartFooter} aria-hidden="true"><LoadingLine /></div>
  </section>;
}
export function HomeLoading({ agenda }: { agenda?: ReactElement }): ReactElement {
  return <section className={styles.pedagogicalWork} role="status" aria-label="Carregando prioridades pedagógicas">
    <div className={styles.workGrid} data-agenda={Boolean(agenda)}><div className={styles.priorityColumn}>
    <div className={styles.sectionHeading}><h2>Prioridades pedagógicas</h2><span className={styles.workScope}>Situação atual · por proximidade e acompanhamento</span></div>
    <div className={styles.priorityTask} aria-hidden="true">
      <div className={styles.priorityMain}>
        <div className={styles.priorityFigure}><LoadingLine size="number" /><LoadingLine size="short" /></div>
        <div className={styles.priorityBody}><LoadingLine size="title" /><LoadingLine size="short" /><LoadingLine /><LoadingLine /><div className={styles.priorityActions}><LoadingLine size="short" /></div></div>
      </div>
      <div className={styles.priorityCases}><LoadingLine /><div className={styles.caseGrid}>{[0,1,2].map(index => <div className={styles.priorityCase} key={index}><LoadingLine size="title" /><LoadingLine /><LoadingLine size="short" /></div>)}</div><LoadingLine size="short" /></div>
    </div>
    </div>{agenda}</div>
    <div className={styles.workSkeleton} aria-hidden="true">{[0,1].map(index => <div key={index}><LoadingLine size="title" /><LoadingLine /><LoadingLine size="short" /></div>)}</div>
  </section>;
}
