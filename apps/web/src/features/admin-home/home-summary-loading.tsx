import type { ReactElement, ReactNode } from "react";
import layout from "./home-summary.module.css";
import styles from "./home-summary-loading.module.css";

function Card({
  title,
  className,
  children,
}: {
  title: string;
  className: string;
  children: ReactNode;
}): ReactElement {
  return (
    <article className={`${className} ${styles.card}`}>
      <div className={layout.storyHeading}>
        <h2>{title}</h2>
        <span className={styles.arrow} />
      </div>
      {children}
    </article>
  );
}

export function HomeSummaryLoading({ audience = false }: { audience?: boolean }): ReactElement {
  return (
    <section aria-label="Indicadores da escola" aria-busy="true">
      <span className="sr-only" role="status">
        Carregando indicadores da escola
      </span>
      <div className={layout.composition} aria-hidden="true">
        {audience ? <AudienceLoading /> : <ReceiptsLoading />}
      </div>
    </section>
  );
}

function ReceiptsLoading(): ReactElement {
  return (
    <Card title="Receita e contratos" className={layout.receipts ?? ""}>
      <div className={styles.cash}>
        <div>
          <span className={styles.number} />
          <span className={styles.caption} />
        </div>
        <div>
          <span className={styles.number} />
          <span className={styles.caption} />
        </div>
      </div>
      <div className={styles.legend}>
        <span className={styles.caption} />
        <span className={styles.caption} />
      </div>
      <div className={styles.plot}>
        <span />
        <span />
        <span />
        <div className={styles.months}>
          {Array.from({ length: 6 }, (_value, index) => (
            <i key={index} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function AudienceLoading(): ReactElement {
  return (
    <>
      <Card title="Alunos por faixa etária" className={layout.students ?? ""}>
        <div className={styles.audience}>
          <div className={styles.ring}>
            <span className={styles.number} />
          </div>
          <div className={styles.rows}>
            {[0, 1, 2].map((index) => (
              <div key={index}>
                <i />
                <span className={styles.caption} />
                <span className={styles.count} />
              </div>
            ))}
          </div>
        </div>
      </Card>
      <Card title="Conversão" className={layout.conversion ?? ""}>
        <div className={styles.figures}>
          <span className={styles.number} />
          <span className={styles.caption} />
        </div>
        <div className={styles.track} />
        <div className={styles.flow}>
          <span className={styles.caption} />
          <span className={styles.caption} />
        </div>
      </Card>
    </>
  );
}
