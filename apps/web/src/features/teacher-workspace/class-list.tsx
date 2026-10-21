import type { JSX as ReactJSX } from "react";
import { MapPin, Video } from "lucide-react";
import { Badge } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { TeacherLinkRow } from "./shared";
import styles from "./workspace.module.css";

type WorkspaceClass = RouterOutputs["teacherWorkspace"]["classes"][number];
const WEEKDAYS: Record<string, string> = {
  MONDAY: "Seg",
  TUESDAY: "Ter",
  WEDNESDAY: "Qua",
  THURSDAY: "Qui",
  FRIDAY: "Sex",
  SATURDAY: "Sáb",
  SUNDAY: "Dom",
};

export function TeacherClassList({ classes }: { classes: WorkspaceClass[] }): ReactJSX.Element {
  const semesters = [...new Set(classes.map((row) => row.semester.name))];
  return (
    <div className={styles.groups}>
      {semesters.map((semester) => {
        const rows = classes.filter((row) => row.semester.name === semester);
        return (
          <section key={semester} className={styles.group} aria-label={semester}>
            <header className={styles.groupHeader}>
              <h2>{semester}</h2>
              <span className={styles.count}>
                {rows.length} {rows.length === 1 ? "turma" : "turmas"}
              </span>
            </header>
            <ul className={styles.list}>
              {rows.map((row) => {
                const FormatIcon = row.format === "ONLINE" ? Video : MapPin;
                return (
                  <li key={row.id}>
                    <TeacherLinkRow
                      href={`/professor/turmas/${row.id}`}
                      title={row.name}
                      trailing={!row.current && <Badge variant="neutral">Histórico</Badge>}
                    >
                      <div className={styles.classMeta}>
                        <span>{row.stage}</span>
                        <span>
                          <FormatIcon className="size-3" aria-hidden="true" />
                          {row.format === "ONLINE" ? "Online" : "Presencial"}
                        </span>
                      </div>
                      <div className={styles.schedule}>
                        {row.schedule.map((slot, index) => (
                          <span key={index}>
                            {WEEKDAYS[slot.weekday] ?? slot.weekday} {slot.startTime}–{slot.endTime}
                          </span>
                        ))}
                      </div>
                    </TeacherLinkRow>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {classes.length === 0 && <p className={styles.empty}>Nenhuma turma encontrada.</p>}
    </div>
  );
}
