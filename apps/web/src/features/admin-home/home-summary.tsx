import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { InlineSkeleton } from "@lazuli/ui";

import type { BusinessData } from "./home-metrics";
import type { HomeData } from "./home-parts";
import { EnrollmentChart, ReceiptsChart } from "./home-summary-charts";
import { LeadConversion, StudentAgeChart } from "./home-audience";
import styles from "./home-summary.module.css";

const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const number = (value: number): string => value.toLocaleString("pt-BR");
const date = (value: string): Date => new Date(`${value}T12:00:00Z`);

export function HomeSummary({
  data,
  business,
  businessError,
}: {
  data: HomeData;
  business: BusinessData | undefined;
  businessError: boolean;
}): ReactElement {
  const school = data.school;
  const month = monthName.format(date(`${school.month}-01`));
  const through = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "numeric",
    timeZone: "UTC",
  }).format(date(school.through));

  return (
    <section aria-label="Indicadores da escola">
      <div className={`${styles.composition} ${styles.ready}`}>
        {data.canViewFinance ? (
          <ReceiptsStory data={business} error={businessError} through={through} month={month} />
        ) : (
          <SchoolStory school={school} />
        )}
      </div>
    </section>
  );
}

export function HomeAudience({ data }: { data: HomeData }): ReactElement {
  return (
    <section aria-label="Alunos e conversão" className={`${styles.composition} ${styles.ready}`}>
      <article className={styles.students}>
        <StoryHeading title="Alunos por faixa etária" href="/alunos?status=ativos" />
        {data.studentAges ? (
          <StudentAgeChart groups={data.studentAges} total={data.activeStudents} />
        ) : (
          <InlineSkeleton className="mt-2 h-24 w-full" />
        )}
      </article>
      <article className={styles.conversion}>
        <StoryHeading title="Conversão" href="/interessados?situacao=ALL" />
        {data.leadConversion ? (
          <LeadConversion data={data.leadConversion} />
        ) : (
          <InlineSkeleton className="mt-2 h-24 w-full" />
        )}
      </article>
    </section>
  );
}

export { HomeSummaryLoading } from "./home-summary-loading";

function StoryHeading({ title, href }: { title: string; href: string }): ReactElement {
  return (
    <div className={styles.storyHeading}>
      <h2>{title}</h2>
      <Link href={href} aria-label={`Abrir ${title.toLocaleLowerCase("pt-BR")}`}>
        <ArrowUpRight aria-hidden="true" />
      </Link>
    </div>
  );
}

function ReceiptsStory({
  data,
  error,
  through,
  month,
}: {
  data: BusinessData | undefined;
  error: boolean;
  through: string;
  month: string;
}): ReactElement {
  return (
    <article className={styles.receipts}>
      <StoryHeading title="Receita e contratos" href="/financeiro" />
      {data ? (
        <>
          <dl className={styles.cashFigures}>
            <div>
              <dt>Recebido até {through}</dt>
              <dd>{money.format(data.receivedCents / 100)}</dd>
            </div>
            <div>
              <dt>Previsto para o mês</dt>
              <dd>{money.format(data.expectedCents / 100)}</dd>
            </div>
            <div>
              <dt>
                <Link href="/contratos">
                  Contratos em {month}{" "}
                  <ArrowUpRight className={styles.inlineArrow} aria-hidden="true" />
                </Link>
              </dt>
              <dd>{number(data.agreements.value)}</dd>
            </div>
          </dl>
          <ReceiptsChart months={data.months} contracts={data.agreements.series} />
        </>
      ) : error ? (
        <p className={styles.unavailable}>
          Não foi possível carregar a receita. <Link href="/financeiro">Abrir financeiro</Link>
        </p>
      ) : (
        <div className={styles.loading} role="status" aria-label="Carregando receita">
          <InlineSkeleton className="h-10 w-48" />
          <InlineSkeleton className="h-28 w-full" />
        </div>
      )}
    </article>
  );
}

function SchoolStory({ school }: { school: HomeData["school"] }): ReactElement {
  return (
    <article className={styles.receipts}>
      <StoryHeading title="Novos alunos" href="/alunos" />
      <div className={styles.enrollmentValue}>
        <strong>{number(school.students.value)}</strong>
        <span>cadastros no mês</span>
      </div>
      <EnrollmentChart series={school.students.series} />
    </article>
  );
}
