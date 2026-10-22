import type { JSX as ReactJSX } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Badge, Tabs, TabsList, TabsTab, TabsPanel } from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import { PlanningWorkspace } from "~/features/stage-planning/workspace";
import { TeacherStudentRow } from "./directory";
import styles from "./workspace.module.css";

type ClassDetail = RouterOutputs["teacherWorkspace"]["class"];
type Lesson = ClassDetail["lessons"][number];

export function TeacherClassTabs({
  detail,
  id,
  tab,
  onTab,
  onSelect,
}: {
  detail: ClassDetail;
  id: string;
  tab: string;
  onTab: (value: string) => void;
  onSelect: (id: string) => void;
}): ReactJSX.Element {
  const showPlanning = detail.current && detail.scheduleType === "REGULAR";
  return (
    <Tabs value={tab} onValueChange={onTab} variant="underline">
      <TabsList aria-label="Seções da turma">
        <TabsTab value="aulas">Aulas</TabsTab>
        <TabsTab value="alunos">Alunos</TabsTab>
        {showPlanning && <TabsTab value="planejamento">Planejamento</TabsTab>}
      </TabsList>
      <TabsPanel value="aulas">
        <LessonList lessons={detail.lessons} onSelect={onSelect} />
      </TabsPanel>
      <TabsPanel value="alunos">
        <StudentList detail={detail} id={id} />
      </TabsPanel>
      {showPlanning && (
        <TabsPanel value="planejamento">
          <div className="min-w-0 pt-4">
            <PlanningWorkspace classId={id} />
          </div>
        </TabsPanel>
      )}
    </Tabs>
  );
}

function LessonList({
  lessons,
  onSelect,
}: {
  lessons: Lesson[];
  onSelect: (id: string) => void;
}): ReactJSX.Element {
  return (
    <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
      {[...lessons].toReversed().map((lesson) => (
        <LessonRow key={lesson.id} lesson={lesson} onSelect={onSelect} />
      ))}
      {lessons.length === 0 && (
        <p className="p-6 text-sm text-muted-foreground">Sem aulas atribuídas neste período.</p>
      )}
    </div>
  );
}

function LessonRow({
  lesson,
  onSelect,
}: {
  lesson: Lesson;
  onSelect: (id: string) => void;
}): ReactJSX.Element {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted"
      onClick={() => onSelect(lesson.id)}
    >
      <span className="text-sm">
        {formatDateOnlyBR(lesson.date)}
        <span className="mt-1 block text-caption text-muted-foreground">
          {lesson.startTime}–{lesson.endTime} · {lesson.teacher}
        </span>
      </span>
      <Badge variant={lesson.state === "PENDING" ? "warning" : "neutral"}>
        {lessonStateLabel(lesson.state)}
      </Badge>
    </button>
  );
}

function lessonStateLabel(state: Lesson["state"]): string {
  if (state === "PENDING") return "Por registrar";
  if (state === "RECORDED") return "Registrada";
  if (state === "CANCELLED") return "Cancelada";
  return "Agendada";
}

function StudentList({ detail, id }: { detail: ClassDetail; id: string }): ReactJSX.Element {
  return (
    <>
      <ul className={styles.list}>
        {detail.students.map((student) => (
          <li key={student.id}>
            <TeacherStudentRow student={student} classId={id} />
          </li>
        ))}
      </ul>
      {detail.students.length === 0 && (
        <p className={styles.empty}>
          {detail.current
            ? "Nenhum aluno vinculado."
            : "A turma está no histórico. Consulte os alunos nos registros das suas aulas."}
        </p>
      )}
    </>
  );
}
