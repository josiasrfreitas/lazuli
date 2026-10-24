"use client";
import { useState, type ReactElement } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@lazuli/ui";
import { trpc, type QueryResult } from "~/lib/trpc";
import { ClassRecordDialog } from "~/features/class-records/class-record-dialog";
import { StudentAppointmentDialog } from "~/features/appointments/student-appointment-dialog";
import { BusinessSummary } from "./home-business";
import { SchoolMetrics } from "./home-metrics";
import { SchoolChart } from "./home-school";
import { HomeStart, isSchoolStarting } from "./home-start";
import { HomeLoading, MetricsLoading, ChartLoading } from "./home-loading";
import { flushSync } from "react-dom";
import { HomeQueue } from "./home-queue";
import { pedagogicalGroups } from "./home-work-model";
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
  const query = trpc.dashboard.home.useQuery(
    { month },
    { refetchInterval: 60_000, placeholderData: (previous) => previous },
  );
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
    const update = (): void => {
      flushSync(() => setSelected(group));
      // View-transition callbacks run asynchronously; focus the newly committed section.
      requestAnimationFrame(() => {
        const work = document.querySelector<HTMLElement>("#home-work");
        work?.scrollIntoView({ block: "nearest" });
        work?.focus({ preventScroll: true });
      });
    };
    if (
      document.startViewTransition &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const transition = document.startViewTransition(update);
      // A second navigation may cancel the visual transition after the state has already changed.
      void transition.ready.catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
      });
    } else update();
  };
  return { query, selected, dialog, open, close, select };
}
export function AdminHome({ name, finance }: { name: string; finance: boolean }): ReactElement {
  const params = useSearchParams();
  const currentMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);
  const monthParam = params.get("mes");
  const month =
    monthParam && /^20\d{2}-(0[1-9]|1[0-2])$/u.test(monthParam) && monthParam <= currentMonth
      ? monthParam
      : currentMonth;
  const { query, selected, dialog, open, close, select } = useAdminHome(month);
  const business = trpc.dashboard.business.useQuery(
    { month },
    { enabled: finance, refetchInterval: 60_000 },
  );
  const router = useRouter();
  const changeMonth = (value: string | null): void => {
    if (!value) return;
    const next = new URLSearchParams(params.toString());
    next.set("mes", value);
    router.replace(`/?${next.toString()}`, { scroll: false });
  };
  const starting = isSchoolStarting(query.data, business.data, finance);
  const showAgenda = query.isPending || Boolean(query.data?.agenda.total);
  const hasPedagogy = Boolean(query.data && pedagogicalGroups(query.data.groups).length > 0);
  const agendaBesideWork = showAgenda && (query.isPending || hasPedagogy);
  const agendaBesideInsights = showAgenda && !agendaBesideWork;
  const schoolPending =
    query.isPending || Boolean(query.data && query.data.school.month !== month && !query.isError);
  return (
    <div className={styles.page}>
      {!selected && (
        <HomeWelcome name={name} data={query.data}>
          <div className={styles.welcomeContext}>
            {query.data && (
              <Link href="/alunos">
                <strong>{query.data.activeStudents.toLocaleString("pt-BR")}</strong> alunos ativos
                <ArrowUpRight aria-hidden="true" />
              </Link>
            )}
            {!showAgenda && query.data && <TodayAgenda data={query.data} compact open={open} />}
          </div>
        </HomeWelcome>
      )}
      {query.isError && (
        <HomeError retry={() => void query.refetch()}>
          {query.data
            ? "Não foi possível atualizar a escola. A última visão carregada continua disponível."
            : "Não foi possível carregar os próximos passos e a agenda. Tente novamente."}
        </HomeError>
      )}
      {selected && query.data ? (
        <HomeQueue data={query.data} selected={selected} select={select} open={open} />
      ) : starting ? (
        <HomeStart />
      ) : (
        <>
          {query.isPending ? (
            <HomeLoading agenda={<TodayAgenda data={undefined} loading open={open} />} />
          ) : (
            query.data && (
              <HomeQueue
                data={query.data}
                selected={null}
                select={select}
                open={open}
                agenda={
                  agendaBesideWork ? <TodayAgenda data={query.data} open={open} /> : undefined
                }
              />
            )
          )}
          <section className={styles.schoolOverview} aria-labelledby="home-overview-title">
            <div className={styles.overviewHeading}>
              <h2 id="home-overview-title">Movimento da escola</h2>
              <MonthPicker value={month} current={currentMonth} change={changeMonth} />
            </div>
            {schoolPending ? <MetricsLoading /> : query.data && <SchoolMetrics data={query.data} />}
            <div
              className={styles.insightsGrid}
              data-sidebar={finance || agendaBesideInsights}
              data-school={Boolean(query.data || query.isPending)}
            >
              {schoolPending ? <ChartLoading /> : query.data && <SchoolChart data={query.data} />}
              {(finance || agendaBesideInsights) && (
                <div className={styles.insightsSide}>
                  {agendaBesideInsights && <TodayAgenda data={query.data} open={open} />}
                  {finance && (
                    <BusinessSummary
                      data={business.data}
                      groups={query.data?.groups ?? []}
                      pending={business.isPending}
                      error={business.isError}
                      retry={() => void business.refetch()}
                      select={select}
                    />
                  )}
                </div>
              )}
            </div>
          </section>
        </>
      )}
      <footer className={styles.footer}>
        <span>Lazuli · Visão da escola</span>
        <nav aria-label="Explorar a escola">
          <Link href="/alunos">
            Alunos
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <Link href="/interessados">
            Leads
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <Link href="/organizacao">
            Organização de turmas
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </nav>
      </footer>
      {dialog?.kind === "lesson" && <ClassRecordDialog id={dialog.id} onClose={close} />}
      {dialog?.kind === "appointment" && (
        <StudentAppointmentDialog
          id={dialog.id}
          admin
          onClose={close}
          onSelect={(id) => open({ kind: "appointment", id })}
        />
      )}
    </div>
  );
}

function MonthPicker({
  value,
  current,
  change,
}: {
  value: string;
  current: string;
  change: (month: string | null) => void;
}): ReactElement {
  const [year, month] = current.split("-").map(Number) as [number, number];
  const options = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - index, 1));
    return {
      value: date.toISOString().slice(0, 7),
      label: new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(date),
    };
  });
  if (!options.some((option) => option.value === value)) options.push({ value, label: value });
  return (
    <div className={styles.periodControl}>
      <span>Indicadores do mês</span>
      <Select value={value} onValueChange={change} items={options}>
        <SelectTrigger size="sm" aria-label="Período dos indicadores">
          <CalendarDays aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem value={option.value} key={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
