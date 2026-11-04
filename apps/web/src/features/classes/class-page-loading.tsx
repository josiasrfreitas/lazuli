import type { ReactElement } from "react";
import { useQueryState } from "nuqs";
import { ClassPerformanceLoading } from "~/features/assessments/assessment-loading";
import { InlineSkeleton } from "@lazuli/ui";
import { ClassOverviewLoading } from "./class-overview-loading";
import { ClassLessonsLoading, LessonPresenceLoading } from "./class-lessons-loading";
import styles from "./class-page.module.css";

export function ClassPageLoading(): ReactElement {
  const [section] = useQueryState("secao");
  return (
    <div
      className={styles.loadingPage}
      data-lessons={section === "aulas" || undefined}
      data-overview={!section || section === "visao-geral" || section === "alunos" || undefined}
      aria-busy="true"
      aria-label="Carregando turma"
    >
      <ClassOverviewLoading />
      <div className={styles.loadingBody}>
        {section === "aulas" ? <ClassLessonsLoading /> : <ClassBodyLoading section={section} />}
      </div>
    </div>
  );
}

function ClassBodyLoading({ section }: { section: string | null }): ReactElement {
  if (section === "desempenho") return <ClassPerformanceLoading />;
  if (section === "planejamento") return <LessonPresenceLoading label="Carregando planejamento…" />;
  return (
    <>
      <div className={styles.overview} aria-hidden="true">
        <div className={styles.overviewGrid}>
          {["schedule", "occupancy", "grades", "progress"].map((item) => (
            <div className="grid gap-2" key={item}>
              <InlineSkeleton className="h-4 w-32" />
              <InlineSkeleton className="h-7 w-24" />
              <InlineSkeleton className="h-4 w-36" />
            </div>
          ))}
        </div>
      </div>
      <div className={styles.overviewWorkspace}>
        <LessonPresenceLoading label="Carregando ocorrências…" />
        <LessonPresenceLoading label="Carregando alunos…" />
      </div>
    </>
  );
}
