"use client";
import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { trpc, type QueryResult } from "~/lib/trpc";
import { ClassRecordDialog } from "~/features/class-records/class-record-dialog";
import { StudentAppointmentDialog } from "~/features/appointments/student-appointment-dialog";
import { HomeBusiness } from "./home-business";
import { HomeQueue } from "./home-queue";
import {
  HomeError,
  HomeLoading,
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
    setSelected(group);
    requestAnimationFrame(() => {
      const work = document.querySelector<HTMLElement>("#home-work");
      work?.scrollIntoView({ block: "nearest" });
      work?.focus({ preventScroll: true });
    });
  };
  return { query, selected, dialog, open, close, select };
}
export function AdminHome(): ReactElement {
  const { query, selected, dialog, open, close, select } = useAdminHome();
  return (
    <div className={styles.page}>
      {query.isPending && <HomeLoading />}
      {query.isError && (
        <HomeError retry={() => void query.refetch()}>
          Não foi possível atualizar seu início. Os dados anteriores, quando disponíveis, continuam
          abaixo.
        </HomeError>
      )}
      {query.data && (
        <>
          <HomeWelcome data={query.data} openGroup={select} />
          <div className={styles.columns}>
            <HomeQueue data={query.data} selected={selected} select={select} open={open} />
            <TodayAgenda data={query.data} open={open} />
          </div>
          {query.data.canViewFinance && <HomeBusiness />}
          <footer className={styles.footer}>
            <span>Lazuli · Um passo de cada vez, a escola segue em frente.</span>
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
