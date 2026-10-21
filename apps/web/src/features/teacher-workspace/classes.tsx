"use client";
import { useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { Badge, Tabs, TabsList, TabsTab, TabsPanel } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { ClassRecordDialog } from "~/features/class-records/class-record-dialog";
import { PlanningWorkspace } from "~/features/stage-planning/workspace";
import { formatDateOnlyBR } from "~/lib/format";
import { TeacherPage, TeacherQueryState } from "./shared";
import { DirectoryTools, directoryMatches, TeacherStudentRow } from "./directory";
import { TeacherClassList } from "./class-list";
import { TeacherListLoading } from "./list-loading";
import styles from "./workspace.module.css";

export function TeacherClasses() {
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

export function TeacherClass({ id }: { id: string }) {
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
        <Tabs
          value={tab}
          onValueChange={(value: string) => {
            void setTab(value);
          }}
          variant="underline"
        >
          <TabsList aria-label="Seções da turma">
            <TabsTab value="aulas">Aulas</TabsTab>
            <TabsTab value="alunos">Alunos</TabsTab>
            {query.data.current && query.data.scheduleType === "REGULAR" && (
              <TabsTab value="planejamento">Planejamento</TabsTab>
            )}
          </TabsList>
          <TabsPanel value="aulas">
            <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
              {[...query.data.lessons].reverse().map((row) => (
                <button
                  type="button"
                  key={row.id}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted"
                  onClick={() => setSelected(row.id)}
                >
                  <span className="text-sm">
                    {formatDateOnlyBR(row.date)}
                    <span className="mt-1 block text-caption text-muted-foreground">
                      {row.startTime}–{row.endTime} · {row.teacher}
                    </span>
                  </span>
                  <Badge variant={row.state === "PENDING" ? "warning" : "neutral"}>
                    {row.state === "PENDING"
                      ? "Por registrar"
                      : row.state === "RECORDED"
                        ? "Registrada"
                        : row.state === "CANCELLED"
                          ? "Cancelada"
                          : "Agendada"}
                  </Badge>
                </button>
              ))}
              {!query.data.lessons.length && (
                <p className="p-6 text-sm text-muted-foreground">
                  Sem aulas atribuídas neste período.
                </p>
              )}
            </div>
          </TabsPanel>
          <TabsPanel value="alunos">
            <ul className={styles.list}>
              {query.data.students.map((row) => (
                <li key={row.id}>
                  <TeacherStudentRow student={row} classId={id} />
                </li>
              ))}
            </ul>
            {!query.data.students.length && (
              <p className={styles.empty}>
                {query.data.current
                  ? "Nenhum aluno vinculado."
                  : "A turma está no histórico. Consulte os alunos nos registros das suas aulas."}
              </p>
            )}
          </TabsPanel>
          {query.data.current && query.data.scheduleType === "REGULAR" && (
            <TabsPanel value="planejamento">
              <div className="min-w-0 pt-4">
                <PlanningWorkspace classId={id} />
              </div>
            </TabsPanel>
          )}
        </Tabs>
      )}
      {selected && <ClassRecordDialog id={selected} onClose={() => setSelected(null)} />}
    </TeacherPage>
  );
}
