"use client";
import { useState } from "react";
import { Check, CalendarDays } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { Alert, Button, ScheduleCalendar, type CalendarView } from "@lazuli/ui";
import { dayLabel } from "~/features/admissions/labels";

type Options = RouterOutputs["students"]["intakeOptions"];
export function IntakeClasses({ data, pending, error, onRetry, selectedId, onSelect, date, onDateChange }: {
  data: Options | undefined;
  pending: boolean;
  error: string | undefined;
  onRetry: () => void;
  selectedId: string;
  onSelect: (id: string) => void;
  date: string;
  onDateChange: (date: string) => void;
}) {
  const [view, setView] = useState<CalendarView>("week");
  const choices = data?.classes ?? [];
  const events = (data?.meetings ?? []).map((meeting, index) => {
    const choice = choices.find(row => row.id === meeting.classId)!;
    return { ...meeting, id: `${meeting.classId}:${meeting.date}:${index}`,
      title: choice.name, subtitle: choice.scheduleType === "PERSONALIZED" ? "PPT" : choice.stageName,
      description: `${choice.enrolled} ${choice.enrolled === 1 ? "aluno" : "alunos"}`,
      tone: meeting.classId === selectedId ? "success" as const : "accent" as const,
    };
  });
  const firstHour = events.length ? Math.min(...events.map(event => Number(event.startTime.slice(0, 2)))) : 8;
  const lastHour = events.length ? Math.max(...events.map(event => Number(event.endTime.slice(0, 2)) + (event.endTime.endsWith(":00") ? 0 : 1))) : 20;
  const hours = { start: `${String(firstHour).padStart(2, "0")}:00`, end: `${String(Math.min(24, Math.max(firstHour + 2, lastHour))).padStart(2, "0")}:00` };
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
    <div className="flex shrink-0 items-center justify-between gap-3">
      <h3 className="text-control font-semibold">{pending && !data ? "Carregando turmas…" : `${choices.length} ${choices.length === 1 ? "turma disponível" : "turmas disponíveis"}`}</h3>
      <span className="text-caption text-muted-foreground">{data?.semester?.name ?? "Semestre atual"}</span>
    </div>
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(6rem,0.6fr)_minmax(12rem,1fr)] gap-5 lg:grid-cols-[minmax(16rem,0.65fr)_minmax(0,1.65fr)] lg:grid-rows-1">
      <div className="scrollbar-subtle min-h-0 overflow-y-auto overscroll-contain pr-2" role="group" aria-label="Escolher turma" tabIndex={0}>
        <div className="grid gap-2">
          {choices.map(choice => <button key={choice.id} type="button" aria-pressed={selectedId === choice.id}
            onClick={() => onSelect(choice.id)}
            className={`grid min-w-0 gap-2 rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:shadow-focus ${selectedId === choice.id ? "border-primary bg-accent" : "border-border hover:bg-accent"}`}>
            <span className="flex items-center justify-between gap-2">
              <span className="text-control font-semibold">{choice.name}</span>
              {selectedId === choice.id && <Check className="size-4 shrink-0 text-primary" aria-label="Selecionada" />}
            </span>
            <span className="grid gap-1 text-caption text-muted-foreground">
              {choice.slots.length ? choice.slots.map(slot => <span key={`${slot.weekday}:${slot.startTime}`}>
                {dayLabel(slot.weekday)} · {slot.startTime}–{slot.endTime}
              </span>) : <span>Sem horário recorrente</span>}
            </span>
            <span className="text-caption text-muted-foreground">{choice.enrolled} {choice.enrolled === 1 ? "aluno" : "alunos"}</span>
          </button>)}
          {!pending && !error && !choices.length && <div className="grid justify-items-start gap-3 rounded-md border border-dashed border-border p-4">
            <CalendarDays className="size-5 text-muted-foreground" />
            <p className="text-caption text-muted-foreground">{data?.semester ? "Nenhuma turma nesta combinação. Altere os filtros ou deixe a turma para depois." : "Não há semestre vigente cadastrado."}</p>
          </div>}
          {error && <Alert variant="destructive">{error}<Button variant="ghost" size="sm" onClick={onRetry}>Tentar novamente</Button></Alert>}
        </div>
      </div>
      <div className="min-h-0 min-w-0 overflow-hidden border-t border-border pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
        <ScheduleCalendar date={date} view={view} events={events} onDateChange={onDateChange} onViewChange={setView}
          minDate={data?.today} maxDate={data?.semester?.endDate.toISOString().slice(0, 10)}
          density="compact" label="Turmas e horários disponíveis" hours={hours}
          className="min-h-0 [&_.lz-calendar-toolbar]:px-1 [&_.lz-calendar-toolbar]:pb-2 [&_.lz-calendar-viewport]:min-h-0"
          status={pending ? "loading" : error ? "error" : "ready"} {...(error ? { errorMessage: error } : {})} onRetry={onRetry}
          onEventActivate={event => onSelect(event.classId)} selectedEventId={events.find(event => event.classId === selectedId)?.id}
          emptyMessage="Sem encontros nesta semana. Escolha outra semana ou consulte os horários da turma." />
      </div>
    </div>
  </div>;
}
