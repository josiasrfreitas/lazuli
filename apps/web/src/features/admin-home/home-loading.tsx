import type { ReactElement } from "react";
import { Wallet, FileCheck2, CircleAlert, Users, GraduationCap, CalendarCheck2 } from "lucide-react";
import styles from "./home.module.css";

export function LoadingLine({ size = "body" }: { size?: "number" | "title" | "body" | "short" }): ReactElement {
  return <span aria-hidden="true" className={styles.placeholder} data-size={size} />;
}
export function MetricsLoading({ finance }: { finance: boolean }): ReactElement {
  const labels = finance ? ["Recebido no mês", "Contratos celebrados", "Em atraso hoje"] : ["Novos alunos", "Matrículas iniciadas", "Experimentais realizadas"];
  const icons = finance ? [Wallet, FileCheck2, CircleAlert] : [Users, GraduationCap, CalendarCheck2];
  return <div className={styles.metrics} role="status" aria-label="Carregando indicadores">{labels.map((label, index) => {
    const Icon = icons[index]!;
    return <div className={styles.metric} data-variant={index === 0 ? "lead" : undefined} key={label} aria-hidden="true">
      <div className={styles.metricHeading}><h2><Icon />{label}</h2></div>
      <div className={styles.metricValue}><LoadingLine size="number" /></div>
      <div className={styles.metricContext}><LoadingLine size="short" /></div>
      <div className={styles.metricBottom}><div><LoadingLine size="short" /><LoadingLine /></div><div className={styles.sparkPlaceholder} /></div>
    </div>;
  })}</div>;
}
export function ChartLoading({ finance }: { finance: boolean }): ReactElement {
  return <section className={styles.chartPanel} role="status" aria-label="Carregando evolução">
    <div className={styles.chartHeading}><div><h2>{finance ? "Como o caixa está evoluindo" : "A escola em movimento"}</h2><p className={styles.description}>Carregando os últimos meses</p></div></div>
    <div className={styles.chartLegend} aria-hidden="true"><LoadingLine size="short" /><LoadingLine size="short" /></div>
    <div className={styles.chartSkeletonPlot} aria-hidden="true"><div /><div /><div /><div /></div>
    <div className={styles.chartSkeletonMonths} aria-hidden="true">{[0,1,2,3,4,5].map(i => <LoadingLine key={i} size="short" />)}</div>
    <div className={styles.chartFooter} aria-hidden="true"><LoadingLine /></div>
  </section>;
}
export function HomeLoading(): ReactElement {
  return <section className={styles.queuePanel} role="status" aria-label="Carregando próximos passos">
    <div className={styles.sectionHeading}><h2>Próximos passos</h2></div>
    <div className={styles.queueSkeleton} aria-hidden="true">{[0,1].map(index => <div key={index}><LoadingLine size="title" /><LoadingLine /><LoadingLine size="short" /></div>)}</div>
  </section>;
}
