import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatBRLFromCents } from "~/lib/format";
import { Trend, type BusinessData } from "./home-metrics";
import { HomeError, type HomeGroup } from "./home-parts";
import { LoadingLine } from "./home-loading";
import { WORK_COPY } from "./home-work-model";
import type { SelectGroup } from "./home-queue";
import styles from "./home.module.css";
const DATE_MONTH_START = 5;
const DATE_DAY_START = 8;
const DATE_MONTH_END = 7;

export function BusinessSummary({
  data,
  groups,
  pending,
  error,
  retry,
  select,
}: {
  data: BusinessData | undefined;
  groups: HomeGroup[];
  pending: boolean;
  error: boolean;
  retry: () => void;
  select: SelectGroup;
}): ReactElement {
  const work = groups.filter((group) => group.area === "finance" && group.total > 0);
  return (
    <section className={styles.businessPanel} aria-labelledby="home-business-title">
      <div className={styles.sectionHeading}>
        <h2 id="home-business-title">Gestão e financeiro</h2>
        <Link className={styles.textLink} href="/financeiro" aria-label="Abrir visão financeira">
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>
      {error && <HomeError retry={retry}>Não foi possível atualizar o financeiro.</HomeError>}
      {pending ? <BusinessLoading /> : data && <BusinessFigures data={data} />}
      {work.length > 0 && <BusinessTasks groups={work} select={select} />}
      <Link className={styles.textLink} href="/financeiro">
        Explorar financeiro
        <ArrowUpRight aria-hidden="true" />
      </Link>
    </section>
  );
}
function BusinessLoading(): ReactElement {
  return (
    <div className={styles.businessLoading} role="status" aria-label="Carregando resumo financeiro">
      <LoadingLine size="short" />
      <LoadingLine size="number" />
      <LoadingLine />
      <div>
        <LoadingLine size="title" />
        <LoadingLine size="title" />
      </div>
    </div>
  );
}
function BusinessFigures({ data }: { data: BusinessData }): ReactElement {
  return (
    <>
      <div className={styles.businessReceived}>
        <span>
          Recebido no mês · até {data.through.slice(DATE_DAY_START)}/
          {data.through.slice(DATE_MONTH_START, DATE_MONTH_END)}
        </span>
        <strong>{formatBRLFromCents(data.receivedCents)}</strong>
        <Trend
          current={data.receivedCents}
          previous={data.previousReceivedCents}
          partial={data.partial}
        />
      </div>
      <div className={styles.businessFacts}>
        <Link href="/financeiro">
          <span>Contratos celebrados</span>
          <strong>{data.agreements.value.toLocaleString("pt-BR")}</strong>
          <small>
            {data.newContracts} novos · {data.renewals} renovações
          </small>
        </Link>
        <Link href="/recebiveis" data-attention={data.overdueCents > 0}>
          <span>Em atraso hoje</span>
          <strong>{formatBRLFromCents(data.overdueCents)}</strong>
          <small>{data.overduePayers.toLocaleString("pt-BR")} pagadores · saldo atual</small>
        </Link>
      </div>
    </>
  );
}
function BusinessTasks({
  groups,
  select,
}: {
  groups: HomeGroup[];
  select: SelectGroup;
}): ReactElement {
  return (
    <div className={styles.businessWork}>
      {groups.map((group) => (
        <button type="button" key={group.kind} onClick={() => select(group)}>
          <strong>{group.total.toLocaleString("pt-BR")}</strong>
          <span>{WORK_COPY[group.kind].action}</span>
          <ArrowUpRight aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
