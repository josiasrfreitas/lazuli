import type { ReactElement } from "react";
import { BookOpen, CalendarDays, ChartNoAxesCombined, UsersRound } from "lucide-react";
import { InlineSkeleton } from "@lazuli/ui";
import { ClassOverviewLoading } from "./class-overview-loading";
import { RosterList } from "./roster-list";
import styles from "./class-page.module.css";

const noop = (): void => {};

export function ClassPageLoading(): ReactElement {
  return (
    <div className={styles.loadingPage} aria-busy="true" aria-label="Carregando turma">
      <ClassOverviewLoading />
      <div className={styles.loadingNavigation} aria-hidden="true">
        <div>
          <span>
            <UsersRound />
            Alunos
          </span>
          <span>
            <ChartNoAxesCombined />
            Desempenho
          </span>
          <span>
            <CalendarDays />
            Aulas
          </span>
          <span>
            <BookOpen />
            Planejamento
          </span>
        </div>
        <InlineSkeleton className="h-8 w-40" />
      </div>
      <RosterList
        data={undefined}
        failed={false}
        refetch={noop}
        page={1}
        setPage={noop}
        close={noop}
        showStage={false}
      />
    </div>
  );
}
