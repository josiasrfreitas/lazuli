"use client";
import { useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { Badge, Button, Input, Tabs, TabsList, TabsTab, TabsPanel } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { ClassRecordDialog } from "~/features/class-records/class-record-dialog";
import { PlanningWorkspace } from "~/features/stage-planning/workspace";
import { formatDateOnlyBR } from "~/lib/format";
import { TeacherPage, TeacherLinkRow, TeacherQueryState } from "./shared";

export function TeacherClasses() {
  const query = trpc.teacherWorkspace.classes.useQuery();
  const [search, setSearch] = useState("");
  const [historical, setHistorical] = useState(false);
  const rows = query.data?.filter((row) => (historical || row.current) && row.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  return <TeacherPage title="Minhas turmas" description="Titularidades, substituições e seus registros anteriores.">
    <Input aria-label="Buscar turma" placeholder="Buscar turma" value={search} onChange={(event) => setSearch(event.target.value)} />
    <Button variant="ghost" aria-pressed={historical} onClick={() => setHistorical(!historical)}>{historical ? "Mostrar somente atuais" : "Incluir histórico"}</Button>
    <TeacherQueryState pending={query.isPending} error={query.error} retry={() => void query.refetch()} />
    {rows && <div className="divide-y divide-border rounded-lg border border-border bg-card">{rows.map((row) => <TeacherLinkRow key={row.id} href={`/professor/turmas/${row.id}`} title={row.name} subtitle={`${row.stage} · ${row.format === "ONLINE" ? "Online" : "Presencial"} · ${row.semester.name}`} trailing={!row.current && <Badge variant="neutral">Histórico</Badge>} />)}{!rows.length && <p className="p-6 text-sm text-muted-foreground">Nenhuma turma encontrada.</p>}</div>}
  </TeacherPage>;
}

export function TeacherClass({ id }: { id: string }) {
  const query = trpc.teacherWorkspace.class.useQuery({ id });
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useQueryState("secao", parseAsString.withDefault("aulas"));
  return <TeacherPage title={query.data?.name ?? "Turma"} description={query.data ? `${query.data.stage} · ${query.data.semester.name}` : "Carregando suas atribuições…"} back="/professor/turmas">
    <TeacherQueryState pending={query.isPending} error={query.error} retry={() => void query.refetch()} />
    {query.data && <Tabs value={tab} onValueChange={setTab} variant="underline">
      <TabsList aria-label="Seções da turma"><TabsTab value="aulas">Aulas</TabsTab><TabsTab value="alunos">Alunos</TabsTab>{query.data.current && query.data.scheduleType === "REGULAR" && <TabsTab value="planejamento">Planejamento</TabsTab>}</TabsList>
      <TabsPanel value="aulas"><div className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">{[...query.data.lessons].reverse().map((row) => <button type="button" key={row.id} className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted" onClick={() => setSelected(row.id)}>
        <span className="text-sm">{formatDateOnlyBR(row.date)}<span className="mt-1 block text-caption text-muted-foreground">{row.startTime}–{row.endTime} · {row.teacher}</span></span><Badge variant={row.state === "PENDING" ? "warning" : "neutral"}>{row.state === "PENDING" ? "Por registrar" : row.state === "RECORDED" ? "Registrada" : row.state === "CANCELLED" ? "Cancelada" : "Agendada"}</Badge>
      </button>)}{!query.data.lessons.length && <p className="p-6 text-sm text-muted-foreground">Sem aulas atribuídas neste período.</p>}</div></TabsPanel>
      <TabsPanel value="alunos"><div className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">{query.data.students.map((row) => <TeacherLinkRow key={row.id} href={`/professor/alunos/${row.id}`} title={row.name} subtitle={row.classes.flatMap((group) => group.progress.map((progress) => progress.stage)).join(" · ")} />)}{!query.data.students.length && <p className="p-6 text-sm text-muted-foreground">{query.data.current ? "Nenhum aluno vinculado." : "A turma está no histórico. Consulte os alunos nos registros das suas aulas."}</p>}</div></TabsPanel>
      {query.data.current && query.data.scheduleType === "REGULAR" && <TabsPanel value="planejamento"><div className="min-w-0 pt-4"><PlanningWorkspace classId={id} /></div></TabsPanel>}
    </Tabs>}
    {selected && <ClassRecordDialog id={selected} onClose={() => setSelected(null)} />}
  </TeacherPage>;
}
