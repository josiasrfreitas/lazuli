"use client";
import Link from "next/link";
import type { ReactElement } from "react";
import { BookOpen } from "lucide-react";
import { DetailHeader, EmptyState, Tabs, TabsList, TabsTab, TabsPanel } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { PlanningState } from "./shared";
import { PlanningWorkspace } from "./workspace";
import { StudentPlanning, studentPlanningOptions } from "./student-planning";
import styles from "./planning.module.css";

/** Teachers retain the planning scope without loading administrative profiles or finance. */
export function TeacherPlanningContext({
  classId,
  studentId,
}: {
  classId?: string;
  studentId?: string;
}): ReactElement {
  const query = trpc.planning.contexts.useQuery();
  const group = query.data?.find((row) => row.id === classId);
  const student = studentId ? studentPlanningOptions(query.data ?? [], studentId)[0] : undefined;
  const title = student?.name ?? group?.name;
  return (
    <div className={styles.teacherPage}>
      <PlanningState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {title && (
        <>
          <DetailHeader title={title} />
          {group?.scheduleType === "PERSONALIZED" ? (
            <>
              <p className="text-sm text-muted-foreground">
                O planejamento PPT pertence ao aluno. Selecione o percurso.
              </p>
              <ul className="grid gap-3">
                {group.students.map((row) => (
                  <li key={row.progressId}>
                    <Link
                      className="text-interactive hover:underline"
                      href={`/alunos/${row.studentId}?secao=planejamento&percurso=${row.progressId}`}
                    >
                      {row.name} · {row.stage}
                      {row.historical ? " · histórico" : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Tabs value="planejamento" variant="underline">
              <TabsList aria-label={student ? "Seções do aluno" : "Seções da turma"}>
                <TabsTab value="planejamento">
                  <BookOpen />
                  Planejamento
                </TabsTab>
              </TabsList>
              <TabsPanel value="planejamento">
                <div className={styles.classPanel}>
                  {studentId ? (
                    <StudentPlanning studentId={studentId} />
                  ) : (
                    group && <PlanningWorkspace classId={group.id} />
                  )}
                </div>
              </TabsPanel>
            </Tabs>
          )}
        </>
      )}
      {query.data && !title && (
        <EmptyState
          title="Planejamento não disponível"
          description="Este aluno ou turma não possui um percurso sob sua responsabilidade."
        />
      )}
    </div>
  );
}
