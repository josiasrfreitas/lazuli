import type { JSX as ReactJSX } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Badge, Tabs, TabsList, TabsTab, TabsPanel } from "@lazuli/ui";
import { StudentFollowUp } from "~/features/pedagogical-follow-up/student-follow-up";
import { StudentPlanning } from "~/features/stage-planning/student-planning";
import { PlanningWorkspace } from "~/features/stage-planning/workspace";
import { AssessmentSummary } from "~/features/assessments/assessment-summary";
import { AssessmentLoading } from "~/features/assessments/assessment-loading";
import { formatDateOnlyBR } from "~/lib/format";
import { trpc } from "~/lib/trpc";
import { TeacherQueryState } from "./shared";

type StudentDetail = RouterOutputs["teacherWorkspace"]["student"];
type Attendance = StudentDetail["attendance"][number];

export function TeacherStudentTabs({
  detail,
  id,
  tab,
  onTab,
  onLesson,
}: {
  detail: StudentDetail;
  id: string;
  tab: string;
  onTab: (value: string) => void;
  onLesson: (id: string) => void;
}): ReactJSX.Element {
  return (
    <Tabs value={tab} onValueChange={onTab} variant="underline">
      <TabsList aria-label="Seções do aluno">
        <TabsTab value="acompanhamento">Acompanhar</TabsTab>
        <TabsTab value="aulas">Aulas</TabsTab>
        {detail.current && (
          <>
            <TabsTab value="planejamento">Planejar</TabsTab>
            <TabsTab value="notas">Notas</TabsTab>
          </>
        )}
      </TabsList>
      <TabsPanel value="acompanhamento">
        <div className="pt-4">
          <StudentFollowUp studentId={id} studentName={detail.name} canRecord={detail.current} />
        </div>
      </TabsPanel>
      <TabsPanel value="aulas">
        <AttendanceList rows={detail.attendance} onLesson={onLesson} />
      </TabsPanel>
      {detail.current && (
        <>
          <TabsPanel value="planejamento">
            <StudentPlanningPanels detail={detail} id={id} />
          </TabsPanel>
          <TabsPanel value="notas">
            <TeacherStudentGrades studentId={id} />
          </TabsPanel>
        </>
      )}
    </Tabs>
  );
}

function AttendanceList({
  rows,
  onLesson,
}: {
  rows: Attendance[];
  onLesson: (id: string) => void;
}): ReactJSX.Element {
  return (
    <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
      {rows.map((row) => (
        <AttendanceRow key={row.id} row={row} onLesson={onLesson} />
      ))}
      {rows.length === 0 && (
        <p className="p-6 text-sm text-muted-foreground">
          Você ainda não registrou aulas deste aluno.
        </p>
      )}
    </div>
  );
}

function AttendanceRow({
  row,
  onLesson,
}: {
  row: Attendance;
  onLesson: (id: string) => void;
}): ReactJSX.Element {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-muted"
      onClick={() => onLesson(row.sessionId)}
    >
      <span className="text-sm">
        {formatDateOnlyBR(row.date)} · {row.className}
      </span>
      <Badge variant={row.status === "PRESENT" ? "success" : "neutral"}>
        {row.status === "PRESENT" ? "Presente" : "Falta"}
      </Badge>
    </button>
  );
}

function StudentPlanningPanels({
  detail,
  id,
}: {
  detail: StudentDetail;
  id: string;
}): ReactJSX.Element {
  return (
    <div className="grid min-w-0 gap-6 pt-4">
      {detail.classes
        .filter((group) => group.scheduleType === "REGULAR")
        .map((group) => (
          <PlanningWorkspace key={group.id} classId={group.id} />
        ))}
      {detail.classes.some((group) => group.scheduleType === "PERSONALIZED") && (
        <StudentPlanning studentId={id} />
      )}
      {detail.classes.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Consulte o planejamento nos seus encontros atribuídos.
        </p>
      )}
    </div>
  );
}

function TeacherStudentGrades({ studentId }: { studentId: string }): ReactJSX.Element {
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
