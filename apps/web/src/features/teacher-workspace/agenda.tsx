"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Video, MapPin, ArrowRight } from "lucide-react";
import { Badge, Button, Input } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { schoolToday, shiftDate } from "~/features/class-records/calendar-model";
import { ClassRecordDialog } from "~/features/class-records/class-record-dialog";
import { CalendarExperimentalDialog } from "~/features/class-records/calendar-experimental-dialog";
import { StudentAppointmentDialog } from "~/features/appointments/student-appointment-dialog";
import { formatDateOnlyBR } from "~/lib/format";
import { TeacherPage, TeacherQueryState } from "./shared";

const purpose = { MAKEUP: "Reposição", PPT_COMPLEMENT: "Complemento PPT", REINFORCEMENT: "Reforço", ASSESSMENT: "Avaliação" };

export function TeacherAgenda() {
  const [date, setDate] = useState(schoolToday);
  const [lesson, setLesson] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<string | null>(null);
  const [experiment, setExperiment] = useState<string | null>(null);
  const query = trpc.teacherWorkspace.agenda.useQuery({ date }, { refetchInterval: 30_000 });
  const selectedVisit = query.data?.experiments.find((row) => row.id === experiment);
  const events = query.data ? [
    ...query.data.lessons.map((row) => ({ id: row.id, kind: "lesson" as const, title: row.className, subtitle: row.stageName ?? "PPT · percursos individuais", start: row.startTime, end: row.endTime, format: row.format,
      status: row.state === "PENDING" ? "Por registrar" : row.state === "RECORDED" ? "Registrada" : row.state === "CANCELLED" ? "Cancelada" : "Agendada", pending: row.state === "PENDING" })),
    ...query.data.appointments.map((row) => ({ id: row.id, kind: "appointment" as const, title: row.student.name, subtitle: purpose[row.purpose], start: row.startTime, end: row.endTime, format: row.format,
      status: row.overdue ? "Por registrar" : row.status === "SCHEDULED" ? "Agendado" : row.status === "CANCELLED" ? "Cancelado" : row.status === "NO_SHOW" ? "Não compareceu" : "Realizado", pending: row.overdue })),
    ...query.data.experiments.map((row) => ({ id: row.id, kind: "experiment" as const, title: row.candidate.fullName, subtitle: row.kind === "PLACEMENT" ? "Nivelamento" : "Aula experimental", start: row.startTime, end: row.endTime, format: row.format,
      status: row.overdue ? "Por registrar" : row.status === "SCHEDULED" ? "Agendada" : row.status === "CANCELLED" ? "Cancelada" : row.status === "ABSENT" ? "Não compareceu" : "Realizada", pending: row.overdue })),
  ].sort((left, right) => left.start.localeCompare(right.start) || left.title.localeCompare(right.title)) : [];
  return <TeacherPage title="Minha agenda" description="Seus encontros e o que precisa de atenção."
    actions={<Button variant="secondary" onClick={() => setDate(schoolToday())}>Hoje</Button>}>
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" aria-label="Dia anterior" onClick={() => setDate(shiftDate(date, -1))}><ChevronLeft /></Button>
      <Input type="date" aria-label="Dia da agenda" value={date} onChange={(event) => { if (event.target.value) setDate(event.target.value); }} />
      <Button variant="ghost" size="icon" aria-label="Próximo dia" onClick={() => setDate(shiftDate(date, 1))}><ChevronRight /></Button>
    </div>
    <TeacherQueryState pending={query.isPending} error={query.error} retry={() => void query.refetch()} />
    {query.data && <section aria-label={`Encontros de ${formatDateOnlyBR(date)}`}>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{formatDateOnlyBR(date)}</h2><span className="text-caption text-muted-foreground">{events.length} encontros</span></div>
      {events.length ? <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {events.map((event) => <button key={`${event.kind}-${event.id}`} type="button"
          className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => event.kind === "lesson" ? setLesson(event.id) : event.kind === "appointment" ? setAppointment(event.id) : setExperiment(event.id)}>
          <div className="shrink-0 text-sm tabular-nums"><strong className="block">{event.start}</strong><span className="text-caption text-muted-foreground">{event.end}</span></div>
          <div className="grid min-w-0 flex-1 gap-2"><span className="text-sm font-semibold">{event.title}</span>
            <span className="text-caption text-muted-foreground">{event.subtitle}</span>
            <div className="flex flex-wrap items-center gap-2"><Badge variant={event.pending ? "warning" : "neutral"}>{event.status}</Badge>
              <span className="flex items-center gap-1 text-caption text-muted-foreground">{event.format === "ONLINE" ? <Video className="size-3.5" /> : <MapPin className="size-3.5" />}{event.format === "ONLINE" ? "Online" : "Presencial"}</span></div>
          </div><ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
        </button>)}
      </div> : <div className="py-10 text-center"><h3 className="font-semibold">Nenhum encontro neste dia</h3><p className="mt-2 text-sm text-muted-foreground">Escolha outra data ou consulte suas turmas.</p></div>}
    </section>}
    <div className="flex flex-wrap gap-4 text-sm text-interactive"><Link href="/professor/atendimentos">Meus atendimentos</Link><Link href="/professor/experimentais">Experimentais e nivelamentos</Link><Link href="/avaliacoes">Notas e provas</Link></div>
    {lesson && <ClassRecordDialog id={lesson} onClose={() => setLesson(null)} />}
    {appointment && <StudentAppointmentDialog id={appointment} admin={false} onClose={() => setAppointment(null)} onSelect={setAppointment} />}
    {selectedVisit && <CalendarExperimentalDialog visit={selectedVisit} admin={false} onClose={() => setExperiment(null)} />}
  </TeacherPage>;
}

export function TeacherPendingPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const query = trpc.teacherWorkspace.pending.useQuery();
  return <TeacherPage title="Aulas por registrar" description="O registro continua disponível mesmo depois do dia da aula." back="/professor">
    <TeacherQueryState pending={query.isPending} error={query.error} retry={() => void query.refetch()} />
    {query.data && <div className="divide-y divide-border rounded-lg border border-border bg-card">{query.data.map((row) => <button key={row.id} className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted" onClick={() => setSelected(row.id)}>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{row.className}</p><p className="mt-1 text-caption text-muted-foreground">{formatDateOnlyBR(row.date)} · {row.startTime}–{row.endTime}</p></div><ArrowRight className="size-4" />
    </button>)}{query.data.length === 0 && <p className="p-6 text-sm text-muted-foreground">Todos os registros de aula estão em dia.</p>}</div>}
    {selected && <ClassRecordDialog id={selected} onClose={() => setSelected(null)} />}
  </TeacherPage>;
}
