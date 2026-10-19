"use client";
import { useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { Badge, Button, Input, Tabs, TabsList, TabsTab, TabsPanel } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { StudentFollowUp } from "~/features/pedagogical-follow-up/student-follow-up";
import { StudentPlanning } from "~/features/stage-planning/student-planning";
import { PlanningWorkspace } from "~/features/stage-planning/workspace";
import { AssessmentSummary } from "~/features/assessments/assessment-summary";
import { ClassRecordDialog } from "~/features/class-records/class-record-dialog";
import { formatDateOnlyBR } from "~/lib/format";
import { TeacherPage, TeacherLinkRow, TeacherQueryState } from "./shared";

export function TeacherStudents() {
  const query = trpc.teacherWorkspace.students.useQuery();
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState(false);
  const rows = query.data?.filter((row) => (history || row.current) && row.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  return <TeacherPage title="Meus alunos" description="Alunos das suas turmas, atendimentos e acompanhamentos.">
    <Input aria-label="Buscar aluno" placeholder="Buscar aluno" value={search} onChange={(event) => setSearch(event.target.value)} />
    <Button variant="ghost" aria-pressed={history} onClick={() => setHistory(!history)}>{history ? "Mostrar somente vínculos atuais" : "Incluir seus registros históricos"}</Button>
    <TeacherQueryState pending={query.isPending} error={query.error} retry={() => void query.refetch()} />
    {rows && <div className="divide-y divide-border rounded-lg border border-border bg-card">{rows.map((row) => <TeacherLinkRow key={row.id} href={`/professor/alunos/${row.id}`} title={row.name} subtitle={row.classes.map((group) => group.name).join(" · ") || "Atendimentos e acompanhamento"} trailing={!row.current && <Badge variant="neutral">Histórico</Badge>} />)}{!rows.length && <p className="p-6 text-sm text-muted-foreground">Nenhum aluno encontrado.</p>}</div>}
  </TeacherPage>;
}

export function TeacherStudent({ id }: { id: string }) {
  const query = trpc.teacherWorkspace.student.useQuery({ id });
  const [tab, setTab] = useQueryState("secao", parseAsString.withDefault("acompanhamento"));
  const [lesson, setLesson] = useState<string | null>(null);
  return <TeacherPage title={query.data?.name ?? "Aluno"} description={query.data?.classes.map((row) => row.name).join(" · ") || "Registros sob sua responsabilidade"} back="/professor/alunos">
    <TeacherQueryState pending={query.isPending} error={query.error} retry={() => void query.refetch()} />
    {query.data && <Tabs value={tab} onValueChange={setTab} variant="underline">
      <TabsList aria-label="Seções do aluno"><TabsTab value="acompanhamento">Acompanhar</TabsTab><TabsTab value="aulas">Aulas</TabsTab>{query.data.current && <><TabsTab value="planejamento">Planejar</TabsTab><TabsTab value="notas">Notas</TabsTab></>}</TabsList>
      <TabsPanel value="acompanhamento"><div className="pt-4"><StudentFollowUp studentId={id} studentName={query.data.name} canRecord={query.data.current} /></div></TabsPanel>
      <TabsPanel value="aulas"><div className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">{query.data.attendance.map((row) => <button type="button" key={row.id} className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-muted" onClick={() => setLesson(row.sessionId)}><span className="text-sm">{formatDateOnlyBR(row.date)} · {row.className}</span><Badge variant={row.status === "PRESENT" ? "success" : "neutral"}>{row.status === "PRESENT" ? "Presente" : "Falta"}</Badge></button>)}{!query.data.attendance.length && <p className="p-6 text-sm text-muted-foreground">Você ainda não registrou aulas deste aluno.</p>}</div></TabsPanel>
      {query.data.current && <><TabsPanel value="planejamento"><div className="grid min-w-0 gap-6 pt-4">{query.data.classes.filter((group) => group.scheduleType === "REGULAR").map((group) => <PlanningWorkspace key={group.id} classId={group.id} />)}{query.data.classes.some((group) => group.scheduleType === "PERSONALIZED") && <StudentPlanning studentId={id} />}{!query.data.classes.length && <p className="text-sm text-muted-foreground">Consulte o planejamento nos seus encontros atribuídos.</p>}</div></TabsPanel><TabsPanel value="notas"><TeacherStudentGrades studentId={id} /></TabsPanel></>}
    </Tabs>}
    {lesson && <ClassRecordDialog id={lesson} onClose={() => setLesson(null)} />}
  </TeacherPage>;
}

function TeacherStudentGrades({ studentId }: { studentId: string }) {
  const query = trpc.assessments.student.useQuery({ studentId });
  return <div className="grid min-w-0 gap-6 pt-4"><TeacherQueryState pending={query.isPending} error={query.error} retry={() => void query.refetch()} />{query.data?.map((row) => <AssessmentSummary key={row.progressId} data={row} />)}{query.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma avaliação sob sua responsabilidade.</p>}</div>;
}
