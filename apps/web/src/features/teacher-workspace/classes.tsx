"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { trpc } from "~/lib/trpc";
import { ClassRecordDialog } from "~/features/class-records/class-record-dialog";
import { TeacherPage, TeacherQueryState } from "./shared";
import { DirectoryTools, directoryMatches } from "./directory";
import { TeacherClassList } from "./class-list";
import { TeacherClassTabs } from "./class-detail";
import { TeacherListLoading } from "./list-loading";
import styles from "./workspace.module.css";

export function TeacherClasses(): ReactJSX.Element {
  const query = trpc.teacherWorkspace.classes.useQuery();
  const [search, setSearch] = useState("");
  const [historical, setHistorical] = useState(false);
  const rows = query.data?.filter(
    (row) =>
      (historical || row.current) &&
      directoryMatches(`${row.name} ${row.stage} ${row.semester.name}`, search),
  );
  return (
    <TeacherPage
      title="Minhas turmas"
      actions={
        rows && (
          <span className={styles.count}>
            {rows.length} {rows.length === 1 ? "turma" : "turmas"}
          </span>
        )
      }
    >
      <DirectoryTools
        subject="turma"
        search={search}
        onSearch={setSearch}
        history={historical}
        onHistory={setHistorical}
      />
      <TeacherQueryState
        loading={<TeacherListLoading kind="classes" label="Carregando suas turmas" />}
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {rows && <TeacherClassList classes={rows} />}
    </TeacherPage>
  );
}

export function TeacherClass({ id }: { id: string }): ReactJSX.Element {
  const query = trpc.teacherWorkspace.class.useQuery({ id });
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useQueryState("secao", parseAsString.withDefault("aulas"));
  return (
    <TeacherPage
      title={query.data?.name ?? "Turma"}
      description={query.data ? `${query.data.stage} · ${query.data.semester.name}` : undefined}
      back="/professor/turmas"
    >
      <TeacherQueryState
        label="Carregando turma"
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && (
        <TeacherClassTabs
          detail={query.data}
          id={id}
          tab={tab}
          onTab={(value) => void setTab(value)}
          onSelect={setSelected}
        />
      )}
      {selected && <ClassRecordDialog id={selected} onClose={() => setSelected(null)} />}
    </TeacherPage>
  );
}
