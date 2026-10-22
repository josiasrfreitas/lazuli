"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { trpc } from "~/lib/trpc";
import { ClassRecordDialog } from "~/features/class-records/class-record-dialog";
import { TeacherPage, TeacherQueryState } from "./shared";
import { DirectoryTools, directoryMatches, GroupedStudents } from "./directory";
import { TeacherListLoading } from "./list-loading";
import { TeacherStudentTabs } from "./student-detail";
import styles from "./workspace.module.css";

export function TeacherStudents(): ReactJSX.Element {
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

export function TeacherStudent({ id }: { id: string }): ReactJSX.Element {
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
        <TeacherStudentTabs
          detail={query.data}
          id={id}
          tab={tab}
          onTab={(value) => void setTab(value)}
          onLesson={setLesson}
        />
      )}
      {lesson && <ClassRecordDialog id={lesson} onClose={() => setLesson(null)} />}
    </TeacherPage>
  );
}
