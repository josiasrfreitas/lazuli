"use client";

import type { JSX as ReactJSX } from "react";
import { useEffect, useState, type FormEvent } from "react";
import { CalendarPlus, X } from "lucide-react";
import {
  Alert,
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  ScheduleCalendar,
  getScheduleCalendarRange,
  type CalendarBlockedInterval,
  type CalendarEvent,
  type CalendarInterval,
  type CalendarView,
  type SearchSelectOption,
} from "@lazuli/ui";
import { entryVisitScheduleSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { parseDateBR } from "~/lib/masks";
import { SelectControl, TextControl } from "~/features/classes/form-controls";
import { MeetingDateField } from "~/features/appointments/form-fields";
import { TeacherPicker } from "~/features/teachers/teacher-picker";
import { TimeField } from "~/features/shared/time-field";
import { DiscardRegistrationDialog } from "~/features/shared/discard-registration-dialog";
import { InterestChoice } from "./candidate-fields";
import { useLeadErrors } from "./lead-form";
import { dateOnly, formatLabel, type Candidate } from "./labels";
import styles from "./visit-dialog.module.css";
import { trialVisitInput } from "./trial-visit-input";

type VisitInput = { candidate: Candidate; previousVisitId?: string; onClose: () => void };
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
function clock(): { date: string; time: string } {
  const now = new Date();
  return {
    date: toDateOnlySaoPaulo(now),
    time: new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(now),
  };
}

export function VisitDialog({ candidate, previousVisitId, onClose }: VisitInput): ReactJSX.Element {
  const previous = candidate.visits.find((row) => row.id === previousVisitId);
  const [dirty, setDirty] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [id] = useState(() => crypto.randomUUID());
  const [now, setNow] = useState(clock);
  const [date, setDate] = useState(() =>
    previous && dateOnly(previous.date) > candidate.today
      ? dateOnly(previous.date)
      : candidate.today,
  );
  const [view, setView] = useState<CalendarView>(
    previous?.kind === "INTRODUCTION" || candidate.scheduleType === "PERSONALIZED" ? "week" : "day",
  );
  const [kind, setKind] = useState<"TRIAL" | "INTRODUCTION">(
    previous?.kind === "INTRODUCTION" || candidate.scheduleType === "PERSONALIZED"
      ? "INTRODUCTION"
      : "TRIAL",
  );
  const [teacher, setTeacher] = useState<SearchSelectOption | null>(
    previous?.teacherId
      ? { id: previous.teacherId, label: previous.teacherName ?? "Professor" }
      : null,
  );
  const [classFilter, setClassFilter] = useState("ALL");
  const [format, setFormat] = useState<"IN_PERSON" | "ONLINE">(
    previous?.format ?? candidate.format ?? "IN_PERSON",
  );
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState(formatDateOnlyBR(date));
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState(previous?.notes ?? "");
  const errors = useLeadErrors();
  const utils = trpc.useUtils();
  useEffect(() => {
    const timer = window.setInterval(() => setNow(clock()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const calendarWindow = { date, view, dayCount: 7, minDate: now.date };
  const period = getScheduleCalendarRange(calendarWindow);
  const calendar = trpc.admissions.visitCalendar.useQuery(
    {
      candidateId: candidate.id,
      ...period,
      ...(kind === "INTRODUCTION" && teacher ? { teacherId: teacher.id } : {}),
      ...(previousVisitId ? { previousVisitId } : {}),
    },
    { retry: false },
  );
  const save = trpc.admissions.schedule.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admissions.invalidate(),
        utils.classRecords.invalidate(),
        utils.teachers.invalidate(),
      ]);
      onClose();
    },
  });
  const meetings = (calendar.data?.meetings ?? []).filter(
    (row) => `${row.date} ${row.startTime}` > `${now.date} ${now.time}`,
  );
  const chosen = meetings.find((row) => row.id === meetingId);
  const blocked: CalendarBlockedInterval[] = [
    ...(calendar.data?.leadBusy ?? []),
    ...(calendar.data?.closedDays ?? []).map((day) => ({
      id: `closed-${day.date}`,
      date: day.date,
      startTime: "00:00",
      endTime: "24:00",
      label: `Escola fechada: ${day.reason}`,
    })),
    ...(kind === "INTRODUCTION"
      ? [
          ...(calendar.data?.teacherBusy ?? []),
          ...(calendar.data?.meetings ?? []).map((row) => ({
            ...row,
            label: `Aula do professor · ${row.className}`,
          })),
        ]
      : []),
  ];
  function intervalError(range: CalendarInterval): string | undefined {
    if (
      !timePattern.test(range.startTime) ||
      !timePattern.test(range.endTime) ||
      range.endTime <= range.startTime
    )
      return "Informe início e término válidos.";
    if (`${range.date} ${range.startTime}` <= `${now.date} ${now.time}`)
      return "Escolha uma aula que ainda não começou.";
    if (
      calendar.isFetching ||
      !calendar.data ||
      range.date < period.from ||
      range.date > period.through
    )
      return "Consulte o período na agenda antes de confirmar.";
    return blocked.find(
      (item) =>
        item.date === range.date &&
        item.startTime < range.endTime &&
        range.startTime < item.endTime,
    )?.label;
  }
  const parsedDate = parseDateBR(draftDate);
  const individual =
    parsedDate && start && end ? { date: parsedDate, startTime: start, endTime: end } : null;
  const selected = kind === "TRIAL" ? (chosen ?? null) : individual;
  const selectionError = selected ? intervalError(selected) : undefined;
  const ready = Boolean(
    selected &&
    !selectionError &&
    calendar.isSuccess &&
    !calendar.isFetching &&
    (kind === "TRIAL" || teacher),
  );
  const events: CalendarEvent[] =
    kind === "TRIAL"
      ? meetings
          .filter((row) => classFilter === "ALL" || row.classId === classFilter)
          .map((row) => {
            const reason = intervalError(row);
            return {
              ...row,
              title: row.className,
              subtitle: `${row.teacherName} · ${formatLabel(row.format)}`,
              description: row.stageName ?? "PPT",
              disabled: Boolean(reason),
              ...(reason ? { disabledReason: reason } : {}),
            };
          })
      : teacher
        ? [
            ...meetings.map((row) => ({
              ...row,
              title: row.className,
              subtitle: "Aula do professor",
              disabled: true,
            })),
            ...(calendar.data?.teacherBusy ?? []).map((row) => ({
              ...row,
              title: row.label,
              disabled: true,
            })),
            ...(calendar.data?.leadBusy ?? []).map((row) => ({
              ...row,
              id: `lead-${row.id}`,
              title: row.label,
              disabled: true,
            })),
          ]
        : [];
  const times = [
    ...(kind === "TRIAL" && events.length > 0 ? [] : ["08:00", "22:00"]),
    ...events.flatMap((row) => [row.startTime, row.endTime]),
    ...(ready && selected ? [selected.startTime, selected.endTime] : []),
  ].toSorted();
  function requestClose(): void {
    if (save.isPending || discarding) return;
    if (dirty) setDiscarding(true);
    else onClose();
  }
  function resetSelection(): void {
    setMeetingId(null);
    setStart("");
    setEnd("");
    errors.clear("schedule");
    save.reset();
  }
  function navigate(next: string): void {
    setDate(next);
    setDraftDate(formatDateOnlyBR(next));
    resetSelection();
  }
  function selectRange(range: CalendarInterval): void {
    setDirty(true);
    setDraftDate(formatDateOnlyBR(range.date));
    setStart(range.startTime);
    setEnd(range.endTime);
    errors.clear("schedule");
    save.reset();
  }
  function submit(event: FormEvent): void {
    event.preventDefault();
    if (save.isPending) return;
    if (!ready || !selected)
      return errors.report([
        { path: ["schedule"], message: selectionError ?? "Escolha o horário na agenda." },
      ]);
    const parsed = entryVisitScheduleSchema.safeParse({
      id,
      candidateId: candidate.id,
      notes,
      ...(previousVisitId ? { previousVisitId } : {}),
      ...(kind === "TRIAL"
        ? trialVisitInput(meetings, meetingId)
        : {
            date: selected.date,
            meeting: {
              kind: "INTRODUCTION",
              teacherId: teacher?.id,
              startTime: selected.startTime,
              endTime: selected.endTime,
              format,
            },
          }),
    });
    if (!parsed.success) return errors.report(parsed.error.issues);
    save.mutate(parsed.data);
  }
  const classOptions = [
    ...new Map(
      meetings.map((row) => [row.classId, { value: row.classId, label: row.className }]),
    ).values(),
  ];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className={styles.dialog}>
          <DialogHeader className="flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
            <DialogTitle>
              {previousVisitId ? "Remarcar experimental" : "Agendar experimental"}
            </DialogTitle>
            <DialogDescription>{candidate.fullName}</DialogDescription>
          </DialogHeader>
          <DialogBody ref={errors.body} className={styles.body}>
            <form
              id="trial-schedule"
              className={styles.form}
              noValidate
              onSubmit={submit}
              onChangeCapture={() => setDirty(true)}
            >
              <fieldset disabled={save.isPending} className={styles.filters}>
                <InterestChoice
                  label="Como será a aula?"
                  value={kind}
                  options={{ TRIAL: "Em uma turma", INTRODUCTION: "Individual" }}
                  onChange={(value) => {
                    setDirty(true);
                    setKind(value as typeof kind);
                    setView(value === "TRIAL" ? "day" : "week");
                    resetSelection();
                  }}
                />
                {kind === "TRIAL" ? (
                  <SelectControl
                    name="trial-class"
                    label="Turma"
                    value={classFilter}
                    choices={[{ value: "ALL", label: "Todas as turmas" }, ...classOptions]}
                    onChange={(value) => {
                      setClassFilter(value);
                      resetSelection();
                    }}
                  />
                ) : (
                  <>
                    <TeacherPicker
                      date={individual?.date ?? date}
                      value={teacher}
                      onChange={(value) => {
                        setDirty(true);
                        setTeacher(value);
                        resetSelection();
                      }}
                      error={errors.fields["meeting.teacherId"] ?? null}
                    />
                    <InterestChoice
                      label="Formato da aula"
                      value={format}
                      options={{ IN_PERSON: "Presencial", ONLINE: "Online" }}
                      onChange={(value) => {
                        setDirty(true);
                        setFormat(value as typeof format);
                      }}
                    />
                  </>
                )}
                <TextControl
                  name="trial-notes"
                  label="Orientações (opcional)"
                  placeholder="O que preparar para a aula"
                  value={notes}
                  onChange={setNotes}
                  error={errors.fields.notes}
                />
              </fieldset>
              <p className="text-caption text-muted-foreground">
                {kind === "TRIAL"
                  ? "Selecione uma aula no calendário. O formato e o professor são os da turma."
                  : "Escolha o professor e clique ou arraste em um horário livre. O formato vale apenas para esta aula."}
              </p>
              <div className={styles.calendar}>
                <ScheduleCalendar
                  {...calendarWindow}
                  label="Agenda da aula experimental"
                  events={events}
                  density="compact"
                  dateLabel={view === "day" ? formatDateOnlyBR(date) : undefined}
                  hours={{ start: times[0]!, end: times.at(-1)! }}
                  status={
                    calendar.isFetching || calendar.isPending
                      ? "loading"
                      : calendar.isError
                        ? "error"
                        : "ready"
                  }
                  onRetry={() => void calendar.refetch()}
                  onDateChange={navigate}
                  onViewChange={(value) => {
                    setView(value);
                    resetSelection();
                  }}
                  selectedEventId={meetingId}
                  onEventActivate={(event) => {
                    if (!save.isPending && kind === "TRIAL") {
                      setDirty(true);
                      setMeetingId(event.id);
                      errors.clear("schedule");
                      save.reset();
                    }
                  }}
                  emptyMessage={
                    kind === "TRIAL"
                      ? "Nenhuma aula futura neste período. Escolha outra data ou turma."
                      : teacher
                        ? "Escolha um horário livre para a experimental."
                        : "Selecione o professor para consultar a agenda."
                  }
                  rangeSelection={
                    kind === "INTRODUCTION" && teacher
                      ? {
                          value: ready ? individual : null,
                          onSelect: selectRange,
                          clickDurationMinutes: 60,
                          minimum: now,
                          blocked,
                          getError: intervalError,
                          controls: <></>,
                        }
                      : undefined
                  }
                />
              </div>
              <div className={styles.footer}>
                {kind === "INTRODUCTION" ? (
                  <fieldset
                    disabled={save.isPending}
                    className={styles.times}
                    aria-label="Horário da experimental"
                  >
                    <MeetingDateField
                      compact
                      fluid
                      minDate={now.date}
                      value={draftDate}
                      error={errors.fields.date}
                      onChange={(value) => {
                        setDraftDate(value);
                        errors.clear("schedule");
                        const parsed = parseDateBR(value);
                        if (parsed && (parsed < period.from || parsed > period.through))
                          setDate(parsed);
                      }}
                    />
                    <TimeField
                      name="trial-start"
                      label="Início"
                      placeholder="hh:mm"
                      align="center"
                      value={start}
                      onChange={setStart}
                      error={errors.fields["meeting.startTime"]}
                    />
                    <TimeField
                      name="trial-end"
                      label="Término"
                      placeholder="hh:mm"
                      align="center"
                      value={end}
                      onChange={setEnd}
                      error={errors.fields["meeting.endTime"]}
                    />
                  </fieldset>
                ) : (
                  <p className="min-w-0 text-sm">
                    {chosen
                      ? `${chosen.className} · ${formatDateOnlyBR(chosen.date)} · ${chosen.startTime}–${chosen.endTime} · ${formatLabel(chosen.format)}`
                      : "Selecione uma aula para continuar."}
                  </p>
                )}
                <div className={styles.actions}>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={save.isPending}
                    onClick={requestClose}
                  >
                    <X />
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" loading={save.isPending} disabled={!ready}>
                    <CalendarPlus />
                    {previousVisitId ? "Confirmar remarcação" : "Agendar experimental"}
                  </Button>
                </div>
              </div>
              {(selectionError || errors.fields.schedule) && (
                <p role="alert" className="text-caption text-destructive">
                  {selectionError || errors.fields.schedule}
                </p>
              )}
              {save.error && <Alert variant="destructive">{save.error.message}</Alert>}
            </form>
          </DialogBody>
        </DialogContent>
        {discarding && (
          <DiscardRegistrationDialog onKeep={() => setDiscarding(false)} onDiscard={onClose} />
        )}
      </DialogPortal>
    </Dialog>
  );
}
