"use client";
import { useState, type ReactElement } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@lazuli/ui";
import { trpc, type QueryResult } from "~/lib/trpc";
import { ClassRecordDialog } from "~/features/class-records/class-record-dialog";
import { StudentAppointmentDialog } from "~/features/appointments/student-appointment-dialog";
import { BusinessChart } from "./home-business";
import { BusinessMetrics, SchoolMetrics } from "./home-metrics";
import { SchoolChart } from "./home-school";
import { HomeStart, isSchoolStarting } from "./home-start";
import { HomeLoading, MetricsLoading, ChartLoading } from "./home-loading";
import { flushSync } from "react-dom";
import { HomeQueue, HomeAttention } from "./home-queue";
import {
  HomeError,
  HomeWelcome,
  TodayAgenda,
  type HomeData,
  type HomeAction,
  type HomeGroup,
} from "./home-parts";
import styles from "./home.module.css";

type AdminHomeState = {
  query: QueryResult<HomeData>;
  selected: HomeGroup | null;
  dialog: Exclude<HomeAction, { kind: "link" }> | null;
  open: (action: HomeAction) => void;
  close: () => void;
  select: (group: HomeGroup | null) => void;
};
function useAdminHome(month: string): AdminHomeState {
  const query = trpc.dashboard.home.useQuery({ month }, { refetchInterval: 60_000 });
  const utils = trpc.useUtils();
  const router = useRouter();
  const [selected, setSelected] = useState<HomeGroup | null>(null);
  const [dialog, setDialog] = useState<Exclude<HomeAction, { kind: "link" }> | null>(null);
  const open = (action: HomeAction): void => {
    if (action.kind === "link") router.push(action.href);
    else setDialog(action);
  };
  const close = (): void => {
    setDialog(null);
    void utils.dashboard.home.invalidate();
    void utils.dashboard.pending.invalidate();
  };
  const select = (group: HomeGroup | null): void => {
    const update = (): void => { flushSync(() => setSelected(group)); };
    if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.startViewTransition(update);
    } else update();
    requestAnimationFrame(() => {
      const work = document.querySelector<HTMLElement>("#home-work");
      work?.scrollIntoView({ block: "nearest" });
      work?.focus({ preventScroll: true });
    });
  };
  return { query, selected, dialog, open, close, select };
}
export function AdminHome({ name, finance }: { name: string; finance: boolean }): ReactElement {
  const params = useSearchParams();
  const currentMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
  const monthParam = params.get("mes");
  const month = monthParam && /^20\d{2}-(0[1-9]|1[0-2])$/u.test(monthParam) && monthParam <= currentMonth ? monthParam : currentMonth;
  const { query, selected, dialog, open, close, select } = useAdminHome(month);
  const business = trpc.dashboard.business.useQuery({ month }, { enabled: finance, refetchInterval: 60_000 });
  const router = useRouter();
  const changeMonth = (value: string | null): void => {
    if (!value) return;
    const next = new URLSearchParams(params.toString());
    next.set("mes", value);
    router.replace(`/?${next.toString()}`, { scroll: false });
  };
  const metricsPending = finance ? business.isPending : query.isPending;
  const starting = isSchoolStarting(query.data, business.data, finance);
  return <div className={styles.page}>
    {!selected && <HomeWelcome name={name} data={query.data}>
      {!starting && <MonthPicker value={month} current={currentMonth} change={changeMonth} />}
    </HomeWelcome>}
    {query.isError && <HomeError retry={() => void query.refetch()}>{query.data ? "Não foi possível atualizar a escola. A última visão carregada continua disponível." : "Não foi possível carregar os próximos passos e a agenda. Tente novamente."}</HomeError>}
    {!selected && query.data && <HomeAttention data={query.data} select={select} />}
    {starting ? <HomeStart /> : <>
    {!selected && <div className={styles.metricsSection}>
      {finance && business.isError && <HomeError retry={() => void business.refetch()}>Não foi possível atualizar os indicadores financeiros. Os próximos passos continuam disponíveis.</HomeError>}
      {metricsPending ? <MetricsLoading finance={finance} /> : finance ? business.data && <BusinessMetrics data={business.data} /> : query.data && <SchoolMetrics data={query.data} />}
    </div>}
    <div className={styles.contentGrid} data-detail={Boolean(selected)}>
      <div className={styles.mainColumn}>
        {selected && query.data ? <HomeQueue data={query.data} selected={selected} select={select} open={open} /> : metricsPending ? <ChartLoading finance={finance} /> : finance && business.data ? <BusinessChart data={business.data} /> : query.data ? <SchoolChart data={query.data} /> : null}
      </div>
      {!selected && <div className={styles.sideColumn}>
        {!selected && (query.isPending ? <HomeLoading /> : query.data && <HomeQueue data={query.data} selected={null} select={select} open={open} />)}
        <TodayAgenda data={query.data} loading={query.isPending} open={open} />
      </div>}
    </div>
    </>}
    <footer className={styles.footer}>
      <span>{query.data ? `${query.data.activeStudents.toLocaleString("pt-BR")} alunos ativos na escola` : "Lazuli · Visão da escola"}</span>
      <nav aria-label="Explorar a escola"><Link href="/alunos">Alunos<ArrowUpRight aria-hidden="true" /></Link><Link href="/interessados">Leads<ArrowUpRight aria-hidden="true" /></Link><Link href="/organizacao">Organização de turmas<ArrowUpRight aria-hidden="true" /></Link></nav>
    </footer>
    {dialog?.kind === "lesson" && <ClassRecordDialog id={dialog.id} onClose={close} />}
    {dialog?.kind === "appointment" && <StudentAppointmentDialog id={dialog.id} admin onClose={close} onSelect={id => open({ kind: "appointment", id })} />}
  </div>;
}
function MonthPicker({ value, current, change }: { value: string; current: string; change: (month: string | null) => void }): ReactElement {
  const [year, month] = current.split("-").map(Number) as [number, number];
  const options = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - index, 1));
    return { value: date.toISOString().slice(0, 7), label: new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(date) };
  });
  if (!options.some(option => option.value === value)) options.push({ value, label: value });
  return <div className={styles.periodControl}><span>Período dos indicadores</span><Select value={value} onValueChange={change} items={options}><SelectTrigger size="sm" aria-label="Período dos indicadores"><CalendarDays aria-hidden="true" /><SelectValue /></SelectTrigger><SelectContent>{options.map(option => <SelectItem value={option.value} key={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><small>Agenda, atrasos e pendências sempre atuais</small></div>;
}
