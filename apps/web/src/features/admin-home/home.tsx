"use client";
import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { trpc, type QueryResult } from "~/lib/trpc";
import { ClassRecordDialog } from "~/features/class-records/class-record-dialog";
import { StudentAppointmentDialog } from "~/features/appointments/student-appointment-dialog";
import { HomeBusiness } from "./home-business";
import { HomeLoading } from "./home-loading";
import { flushSync } from "react-dom";
import { HomeQueue } from "./home-queue";
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
function useAdminHome(): AdminHomeState {
  const query = trpc.dashboard.home.useQuery(undefined, { refetchInterval: 60_000 });
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
  const { query, selected, dialog, open, close, select } = useAdminHome();
  const pendingGroups = query.data?.groups.filter(group => group.total > 0) ?? [];
  const insightsFirst = !selected && pendingGroups.length <= 2 && !pendingGroups.some(group => group.attention);
  return (
    <div className={styles.page}>
      <HomeWelcome name={name} data={query.data} />
      <div className={styles.columns} data-insights-first={finance && insightsFirst}>
        <div className={styles.mainColumn}>
          {finance && insightsFirst && <HomeBusiness key="business" />}
          {query.isPending && <HomeLoading finance={finance} />}
          {query.isError && (
            <HomeError retry={() => void query.refetch()}>
              {query.data ? "Não foi possível atualizar seu início. A última visão carregada continua abaixo." : "Não foi possível carregar a visão da escola. Tente novamente."}
            </HomeError>
          )}
          {query.data && !(finance && insightsFirst) && <HomeQueue data={query.data} selected={selected} select={select} open={open} />}
          {finance && !insightsFirst && <HomeBusiness key="business" />}
        </div>
        <div className={styles.sideColumn}>
          {query.data && finance && insightsFirst && <HomeQueue data={query.data} selected={selected} select={select} open={open} />}
          <TodayAgenda data={query.data} open={open} />
        </div>
      </div>
      {query.data && (
        <>
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
        </>
      )}
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
