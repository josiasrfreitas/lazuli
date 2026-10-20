"use client";
import { useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { Badge, Tabs, TabsList, TabsTab, TabsPanel } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { StudentFollowUp } from "~/features/pedagogical-follow-up/student-follow-up";
import { StudentPlanning } from "~/features/stage-planning/student-planning";
import { PlanningWorkspace } from "~/features/stage-planning/workspace";
import { AssessmentSummary } from "~/features/assessments/assessment-summary";
import { AssessmentLoading } from "~/features/assessments/assessment-loading";
import { ClassRecordDialog } from "~/features/class-records/class-record-dialog";
import { formatDateOnlyBR } from "~/lib/format";
import { TeacherPage, TeacherQueryState } from "./shared";
import { DirectoryTools, directoryMatches, GroupedStudents } from "./directory";
import { TeacherListLoading } from "./list-loading";
import styles from "./workspace.module.css";

export function TeacherStudents() {
  const query = trpc.teacherWorkspace.students.useQuery();
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState(false);
  const rows = query.data?.filter(
    (row) =>
      (history || row.current) &&
      directoryMatches([row.name, ...row.classes.map((group) => group.name)].join(" "), search),
  );
  return (
    <TeacherPage
      title="Meus alunos"
      actions={
        rows && (
          <span className={styles.count}>
            {rows.length} {rows.length === 1 ? "aluno" : "alunos"}
          </span>
        )
      }
    >
      <DirectoryTools
        subject="aluno"
        search={search}
        onSearch={setSearch}
        history={history}
        onHistory={setHistory}
      />
      <TeacherQueryState
        loading={<TeacherListLoading kind="students" label="Carregando seus alunos" />}
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {rows && <GroupedStudents students={rows} />}
    </TeacherPage>
  );
}

export function TeacherStudent({ id }: { id: string }) {
  const query = trpc.teacherWorkspace.student.useQuery({ id });
  const [tab, setTab] = useQueryState("secao", parseAsString.withDefault("acompanhamento"));
  const [lesson, setLesson] = useState<string | null>(null);
  return (
    <TeacherPage
      title={query.data?.name ?? "Aluno"}
      description={
        query.data?.classes.map((row) => row.name).join(" · ") ||
        "Registros sob sua responsabilidade"
      }
      back="/professor/alunos"
    >
      <TeacherQueryState
        label="Carregando aluno"
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && (
        <Tabs value={tab} onValueChange={setTab} variant="underline">
          <TabsList aria-label="Seções do aluno">
            <TabsTab value="acompanhamento">Acompanhar</TabsTab>
            <TabsTab value="aulas">Aulas</TabsTab>
            {query.data.current && (
              <>
                <TabsTab value="planejamento">Planejar</TabsTab>
                <TabsTab value="notas">Notas</TabsTab>
              </>
            )}
          </TabsList>
          <TabsPanel value="acompanhamento">
            <div className="pt-4">
              <StudentFollowUp
                studentId={id}
                studentName={query.data.name}
                canRecord={query.data.current}
              />
            </div>
          </TabsPanel>
          <TabsPanel value="aulas">
            <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
              {query.data.attendance.map((row) => (
                <button
                  type="button"
                  key={row.id}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-muted"
                  onClick={() => setLesson(row.sessionId)}
                >
                  <span className="text-sm">
                    {formatDateOnlyBR(row.date)} · {row.className}
                  </span>
                  <Badge variant={row.status === "PRESENT" ? "success" : "neutral"}>
                    {row.status === "PRESENT" ? "Presente" : "Falta"}
                  </Badge>
                </button>
              ))}
              {!query.data.attendance.length && (
                <p className="p-6 text-sm text-muted-foreground">
                  Você ainda não registrou aulas deste aluno.
                </p>
              )}
            </div>
          </TabsPanel>
          {query.data.current && (
            <>
              <TabsPanel value="planejamento">
                <div className="grid min-w-0 gap-6 pt-4">
                  {query.data.classes
                    .filter((group) => group.scheduleType === "REGULAR")
                    .map((group) => (
                      <PlanningWorkspace key={group.id} classId={group.id} />
                    ))}
                  {query.data.classes.some((group) => group.scheduleType === "PERSONALIZED") && (
                    <StudentPlanning studentId={id} />
                  )}
                  {!query.data.classes.length && (
                    <p className="text-sm text-muted-foreground">
                      Consulte o planejamento nos seus encontros atribuídos.
                    </p>
                  )}
                </div>
              </TabsPanel>
              <TabsPanel value="notas">
                <TeacherStudentGrades studentId={id} />
              </TabsPanel>
            </>
          )}
        </Tabs>
      )}
      {lesson && <ClassRecordDialog id={lesson} onClose={() => setLesson(null)} />}
    </TeacherPage>
  );
}

function TeacherStudentGrades({ studentId }: { studentId: string }) {
  const query = trpc.assessments.student.useQuery({ studentId });
  return (
    <div className="grid min-w-0 gap-6 pt-4">
      <TeacherQueryState
        label="Carregando avaliações"
        loading={<AssessmentLoading heading />}
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data?.map((row) => (
        <AssessmentSummary key={row.progressId} data={row} />
      ))}
      {query.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma avaliação sob sua responsabilidade.</p>
      )}
    </div>
  );
}
