import type { JSX as ReactJSX } from "react";
import Link from "next/link";
import { Avatar, Badge, Button, Input } from "@lazuli/ui";
import { History } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { TeacherLinkRow } from "./shared";
import styles from "./workspace.module.css";

export type WorkspaceStudent = RouterOutputs["teacherWorkspace"]["students"][number];

export function DirectoryTools({
  subject,
  search,
  onSearch,
  history,
  onHistory,
}: {
  subject: "aluno" | "turma";
  search: string;
  onSearch: (value: string) => void;
  history: boolean;
  onHistory: (value: boolean) => void;
}): ReactJSX.Element {
  return (
    <div className={styles.tools}>
      <div className={styles.search}>
        <Input
          aria-label={`Buscar ${subject}`}
          placeholder={subject === "aluno" ? "Buscar aluno ou turma" : "Buscar turma"}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>
      <Button
        variant={history ? "secondary" : "ghost"}
        size="sm"
        aria-label="Incluir histórico"
        aria-pressed={history}
        onClick={() => onHistory(!history)}
      >
        <History aria-hidden="true" />
        Histórico
      </Button>
    </div>
  );
}

export function directoryMatches(value: string, search: string): boolean {
  const normalize = (text: string): string =>
    text
      .normalize("NFD")
      .replaceAll(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("pt-BR");
  return normalize(value).includes(normalize(search.trim()));
}

export function groupStudents(students: WorkspaceStudent[]) {
  const groups = new Map<string, { id: string; name: string; students: WorkspaceStudent[] }>();
  for (const student of students) {
    const memberships =
      student.classes.length > 0
        ? student.classes
        : [{ id: "", name: "Acompanhamento individual" }];
    for (const membership of memberships) {
      const group = groups.get(membership.id) ?? {
        id: membership.id,
        name: membership.name,
        students: [],
      };
      if (!group.students.some((row) => row.id === student.id)) group.students.push(student);
      groups.set(membership.id, group);
    }
  }
  return [...groups.values()].sort((left, right) =>
    left.id ? (right.id ? left.name.localeCompare(right.name, "pt-BR") : -1) : 1,
  );
}

export function TeacherStudentRow({
  student,
  classId,
}: {
  student: WorkspaceStudent;
  classId?: string;
}): ReactJSX.Element {
  const stages = [
    ...new Set(
      student.classes
        .filter((group) => !classId || group.id === classId)
        .flatMap((group) => group.progress.map((progress) => progress.stage)),
    ),
  ];
  return (
    <TeacherLinkRow
      href={`/professor/alunos/${student.id}`}
      title={student.name}
      leading={<Avatar name={student.name} colorKey={student.id} />}
      subtitle={stages.join(" · ")}
      trailing={!student.current && <Badge variant="neutral">Histórico</Badge>}
    />
  );
}

export function GroupedStudents({ students }: { students: WorkspaceStudent[] }): ReactJSX.Element {
  return (
    <div className={styles.groups}>
      {groupStudents(students).map((group) => (
        <section key={group.id} className={styles.group} aria-label={group.name}>
          <header className={styles.groupHeader}>
            <h2>
              {group.id ? (
                <Link href={`/professor/turmas/${group.id}`}>{group.name}</Link>
              ) : (
                group.name
              )}
            </h2>
            <span className={styles.count}>
              {group.students.length} {group.students.length === 1 ? "aluno" : "alunos"}
            </span>
          </header>
          <ul className={styles.list}>
            {group.students.map((student) => (
              <li key={student.id}>
                <TeacherStudentRow student={student} classId={group.id} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {students.length === 0 && <p className={styles.empty}>Nenhum aluno encontrado.</p>}
    </div>
  );
}
