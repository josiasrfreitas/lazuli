"use client";
import Link from "next/link";
import type { ReactElement } from "react";
import { BookOpen } from "lucide-react";
import { DetailHeader, EmptyState, Tabs, TabsList, TabsTab, TabsPanel } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { PlanningState } from "./shared";
import { PlanningWorkspace } from "./workspace";
import { StudentPlanning, studentPlanningOptions } from "./student-planning";
import styles from "./planning.module.css";

type Context = RouterOutputs["planning"]["contexts"][number];

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
        <TeacherPlanningContent
          title={title}
          group={group}
          studentId={studentId}
          hasStudent={Boolean(student)}
        />
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

function TeacherPlanningContent({
  title,
  group,
  studentId,
  hasStudent,
}: {
  title: string;
  group: Context | undefined;
  studentId: string | undefined;
  hasStudent: boolean;
}): ReactElement {
  return (
    <>
      <DetailHeader title={title} />
      {group?.scheduleType === "PERSONALIZED" ? (
        <PersonalizedPlanningList group={group} />
      ) : (
        <TeacherPlanningTabs group={group} studentId={studentId} hasStudent={hasStudent} />
      )}
    </>
  );
}

function PersonalizedPlanningList({ group }: { group: Context }): ReactElement {
  return (
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
  );
}

function TeacherPlanningTabs({
  group,
  studentId,
  hasStudent,
}: {
  group: Context | undefined;
  studentId: string | undefined;
  hasStudent: boolean;
}): ReactElement {
  return (
    <Tabs value="planejamento" variant="underline">
      <TabsList aria-label={hasStudent ? "Seções do aluno" : "Seções da turma"}>
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
  );
}
