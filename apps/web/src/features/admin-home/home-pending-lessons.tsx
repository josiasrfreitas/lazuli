import type { ReactElement } from "react";
import Link from "next/link";
import { ChevronDown, ClipboardList, X, BookOpen } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { PendingDisclosure } from "./home-pending-disclosure";
import styles from "./home-pending.module.css";

type Teacher = RouterOutputs["dashboard"]["pendingLessons"][number];

export function PendingLessons({ teachers }: { teachers: Teacher[] }): ReactElement | null {
  if (teachers.length === 0) return null;
  return (
    <>
      {teachers.map((teacher) => (
        <tr key={teacher.teacherId ?? "unassigned"}>
          <td className={styles.cell}>
            <TeacherGroup teacher={teacher} />
          </td>
        </tr>
      ))}
    </>
  );
}

function TeacherGroup({ teacher }: { teacher: Teacher }): ReactElement {
  return (
    <PendingDisclosure
      summary={
        <>
          <span className={`${styles.icon} ${styles.recordIcon}`}>
            <ClipboardList aria-hidden="true" />
          </span>
          <span className={styles.identity}>
            <strong>Aulas sem registro</strong>
            <span>
              {teacher.teacherName} · {teacher.lessons.length}{" "}
              {teacher.lessons.length === 1 ? "aula" : "aulas"}
            </span>
          </span>
          <span className={styles.priorities}>
            {teacher.high > 0 && (
              <span className={styles.highPriority}>
                {teacher.high} {teacher.high === 1 ? "muito atrasada" : "muito atrasadas"}
              </span>
            )}
            {teacher.low > 0 && (
              <span>
                {teacher.low} {teacher.low === 1 ? "baixa" : "baixas"}
              </span>
            )}
          </span>
          <span className={styles.action}>
            <ChevronDown aria-hidden="true" />
          </span>
        </>
      }
    >
      <LessonList teacher={teacher} />
    </PendingDisclosure>
  );
}

function LessonList({ teacher }: { teacher: Teacher }): ReactElement {
  return (
    <ul className={styles.lessonList}>
      {teacher.lessons.map((lesson) => (
        <LessonCase key={lesson.id} lesson={lesson} />
      ))}
    </ul>
  );
}

const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" });

function MissingIndicators({
  missing,
  priority,
}: {
  missing: string[];
  priority: "high" | "low";
}): ReactElement {
  return (
    <span className={styles.missingIndicators} data-priority={priority}>
      <X aria-hidden="true" />
      <span>
        <span className="sr-only">Pendente: </span>
        {missing.join(" · ")}
      </span>
    </span>
  );
}

function LessonCase({ lesson }: { lesson: Teacher["lessons"][number] }): ReactElement {
  return (
    <li>
      <Link
        href={`/turmas/${lesson.classId}?secao=aulas&aula=${lesson.id}&voltar=%2F`}
        className={styles.lessonCase}
      >
        <span className={styles.lessonIdentity}>
          <strong>
            {lesson.className} ·{" "}
            {weekday.format(new Date(`${lesson.date}T12:00:00Z`)).replace("-feira", "")}{" "}
            {lesson.startTime}
          </strong>
          <span>{lesson.date.split("-").toReversed().slice(0, 2).join("/")}</span>
          <MissingIndicators missing={lesson.missing} priority={lesson.priority} />
        </span>
        <span className={lesson.priority === "high" ? styles.highPriority : styles.preview}>
          {lesson.ageDays} {lesson.ageDays === 1 ? "dia" : "dias"}
        </span>
        <span className={styles.action}>
          <BookOpen aria-hidden="true" />
          <span className="sr-only">Ver aula</span>
        </span>
      </Link>
    </li>
  );
}
