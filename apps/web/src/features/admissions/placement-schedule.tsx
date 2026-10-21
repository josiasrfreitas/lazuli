"use client";

import type { JSX as ReactJSX } from "react";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CalendarPlus, X } from "lucide-react";
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
  Stepper,
  getScheduleCalendarRange,
  type CalendarBlockedInterval,
  type CalendarEvent,
  type CalendarInterval,
  type CalendarView,
} from "@lazuli/ui";
import { placementScheduleSchema, type z } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { parseDateBR } from "~/lib/masks";
import { MeetingDateField } from "~/features/appointments/form-fields";
import { TimeField } from "~/features/shared/time-field";
import { DiscardRegistrationDialog } from "~/features/shared/discard-registration-dialog";
import { InterestChoice } from "./candidate-fields";
import { useLeadErrors } from "./lead-form";
import type { Candidate } from "./labels";
import styles from "./placement-schedule.module.css";

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export type PlacementScheduleDraft = {
  date: string;
  startTime: string;
  endTime: string;
  format: "IN_PERSON" | "ONLINE";
};

function schoolClock() {
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

export function PlacementSchedule({
  candidate,
  onClose,
  registration,
}: {
  candidate: Pick<Candidate, "id" | "fullName" | "today" | "format">;
  onClose: () => void;
  registration?: {
    id?: string;
    onConfirm: (values: z.infer<typeof placementScheduleSchema>) => void;
    onBack: () => void;
    onDefer: () => void;
    onDirty: () => void;
    draft: PlacementScheduleDraft | null;
    onDraftChange: (draft: PlacementScheduleDraft) => void;
    pending: boolean;
    error?: string | undefined;
  };
}): ReactJSX.Element {
  const [dirty, setDirty] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [id] = useState(() => registration?.id ?? crypto.randomUUID());
  const [now, setNow] = useState(schoolClock);
  const [calendarDate, setCalendarDate] = useState(
    () => parseDateBR(registration?.draft?.date ?? "") ?? candidate.today,
  );
  const [view, setView] = useState<CalendarView>("week");
  const [draft, setDraft] = useState<PlacementScheduleDraft>(
    () =>
      registration?.draft ?? {
        date: formatDateOnlyBR(candidate.today),
        startTime: "",
        endTime: "",
        format: candidate.format ?? "IN_PERSON",
      },
  );
  const onDraftChange = registration?.onDraftChange;
  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(schoolClock()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const errors = useLeadErrors();
  const utils = trpc.useUtils();
  const calendarWindow = { date: calendarDate, view, dayCount: 7, minDate: now.date };
  const period = getScheduleCalendarRange(calendarWindow);
  const calendar = trpc.admissions.placementCalendar.useQuery(
    { ...(registration ? {} : { candidateId: candidate.id }), ...period },
    { retry: false, refetchOnWindowFocus: true },
  );
  const save = trpc.admissions.placementSchedule.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admissions.invalidate(),
        utils.classRecords.invalidate(),
        utils.students.pendingActions.invalidate(),
      ]);
      onClose();
    },
  });
  const pending = save.isPending || Boolean(registration?.pending);
  function requestClose(): void {
    if (pending || discarding) return;
    if (!registration && dirty) setDiscarding(true);
    else onClose();
  }
  function markDirty(): void {
    setDirty(true);
    registration?.onDirty();
  }
  function change<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]): void {
    markDirty();
    setDraft((current) => ({ ...current, [key]: value }));
    errors.clear(key);
    errors.clear("schedule");
    save.reset();
  }
  function navigate(date: string): void {
    setCalendarDate(date);
    setDraft((current) => ({
      ...current,
      date: formatDateOnlyBR(date),
      startTime: "",
      endTime: "",
    }));
    errors.clear("date");
    errors.clear("schedule");
    save.reset();
  }
  const blocked: CalendarBlockedInterval[] = [
    ...(calendar.data?.visits ?? []),
    ...(calendar.data?.closedDays ?? []).map((day) => ({
      id: `closed-${day.date}`,
      date: day.date,
      startTime: "00:00",
      endTime: "24:00",
      label: `Escola fechada: ${day.reason}`,
    })),
  ];
  const events: CalendarEvent[] = (calendar.data?.visits ?? []).map((visit) => ({
    ...visit,
    title: visit.label,
    disabled: true,
    disabledReason: "Este lead já tem um atendimento neste horário.",
  }));
  function intervalError(range: CalendarInterval): string | undefined {
    if (!timePattern.test(range.startTime) || !timePattern.test(range.endTime))
      return "Informe início e término em hh:mm.";
    if (range.endTime <= range.startTime) return "O término deve ser posterior ao início.";
    if (`${range.date} ${range.startTime}` <= `${now.date} ${now.time}`)
      return "Escolha um horário que ainda não começou.";
    if (
      !calendar.data ||
      calendar.isFetching ||
      range.date < period.from ||
      range.date > period.through
    )
      return "Consulte o período na agenda antes de confirmar.";
    if (calendar.data.pendingPlacement)
      return "Este lead já tem um nivelamento agendado. Conclua ou cancele o atendimento anterior.";
    const conflict = blocked.find(
      (item) =>
        item.date === range.date &&
        item.startTime < range.endTime &&
        range.startTime < item.endTime,
    );
    return conflict?.label;
  }
  const parsedDate = parseDateBR(draft.date);
  const selection =
    parsedDate && draft.startTime && draft.endTime
      ? { date: parsedDate, startTime: draft.startTime, endTime: draft.endTime }
      : null;
  const selectionError = selection ? intervalError(selection) : undefined;
  const ready = calendar.isSuccess && !calendar.isFetching && selection && !selectionError;
  const times = [
    "08:00",
    "22:00",
    ...events.flatMap((event) => [event.startTime, event.endTime]),
    ...(selection && !selectionError ? [selection.startTime, selection.endTime] : []),
  ].toSorted();
  function submit(event: FormEvent): void {
    event.preventDefault();
    if (pending) return;
    if (!parsedDate) {
      errors.report([{ path: ["date"], message: "Informe uma data válida: dd/mm/aaaa." }]);
      return;
    }
    const parsed = placementScheduleSchema.safeParse({
      id,
      candidateId: candidate.id,
      ...draft,
      date: parsedDate,
    });
    if (!parsed.success) return errors.report(parsed.error.issues);
    const message = intervalError(parsed.data);
    if (message) return errors.report([{ path: ["schedule"], message }]);
    if (registration) registration.onConfirm(parsed.data);
    else save.mutate(parsed.data);
  }
  const message =
    selectionError ||
    errors.fields.schedule ||
    (calendar.data?.pendingPlacement ? "Este lead já tem um nivelamento agendado." : undefined);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className={styles.dialog}
          initialFocus={() => document.getElementById("appointment-date")}
        >
          <DialogHeader className="flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
            <DialogTitle>Agendar nivelamento</DialogTitle>
            <DialogDescription>{candidate.fullName}</DialogDescription>
          </DialogHeader>
          {registration && (
            <Stepper
              className="mt-4"
              steps={[{ label: "Lead" }, { label: "Nivelamento" }]}
              activeIndex={1}
              label="Cadastro do lead"
            />
          )}
          <DialogBody ref={errors.body} className={styles.body}>
            <form id="placement-schedule" noValidate onSubmit={submit} className={styles.form}>
              <p className="text-caption text-muted-foreground">
                Clique ou arraste na agenda para escolher o horário. A prova não exige professor no
                agendamento.
              </p>
              <div className={styles.calendar}>
                <ScheduleCalendar
                  {...calendarWindow}
                  label="Agenda para nivelamento"
                  events={events}
                  hours={{ start: times[0]!, end: times.at(-1)! }}
                  density="compact"
                  expandEvents={false}
                  status={
                    calendar.isFetching || calendar.isPending
                      ? "loading"
                      : calendar.isError
                        ? "error"
                        : "ready"
                  }
                  errorMessage="Não foi possível carregar a agenda do nivelamento."
                  onRetry={() => void calendar.refetch()}
                  onDateChange={navigate}
                  onViewChange={setView}
                  emptyMessage="Escolha um horário para a prova de nivelamento."
                  rangeSelection={{
                    clickDurationMinutes: 30,
                    value: ready ? selection : null,
                    minimum: now,
                    blocked,
                    getError: intervalError,
                    controls: <></>,
                    onSelect: (range) => {
                      if (pending) return;
                      markDirty();
                      setDraft((current) => ({
                        ...current,
                        ...range,
                        date: formatDateOnlyBR(range.date),
                      }));
                      errors.clear("date");
                      errors.clear("startTime");
                      errors.clear("endTime");
                      errors.clear("schedule");
                      save.reset();
                    },
                  }}
                />
              </div>
              <div className={styles.footer}>
                <fieldset
                  disabled={pending}
                  className={styles.selection}
                  aria-label="Horário do nivelamento"
                >
                  <MeetingDateField
                    compact
                    fluid
                    minDate={now.date}
                    value={draft.date}
                    error={errors.fields.date}
                    onChange={(value) => {
                      change("date", value);
                      const date = parseDateBR(value);
                      if (date && (date < period.from || date > period.through))
                        setCalendarDate(date);
                    }}
                  />
                  <TimeField
                    name="placement-start"
                    label="Início"
                    placeholder="hh:mm"
                    align="center"
                    value={draft.startTime}
                    onChange={(value) => change("startTime", value)}
                    error={errors.fields.startTime}
                  />
                  <TimeField
                    name="placement-end"
                    label="Término"
                    placeholder="hh:mm"
                    align="center"
                    value={draft.endTime}
                    onChange={(value) => change("endTime", value)}
                    error={errors.fields.endTime}
                  />
                  <InterestChoice
                    label="Aplicação da prova"
                    value={draft.format}
                    options={{ IN_PERSON: "Na escola", ONLINE: "Online" }}
                    onChange={(value) => change("format", value as (typeof draft)["format"])}
                  />
                </fieldset>
                <div className={styles.actions}>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={registration ? registration.onBack : requestClose}
                  >
                    {registration ? <ArrowLeft aria-hidden="true" /> : <X aria-hidden="true" />}
                    {registration ? "Voltar ao lead" : "Cancelar"}
                  </Button>
                  {registration && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pending}
                      onClick={registration.onDefer}
                    >
                      Salvar sem agendamento
                    </Button>
                  )}
                  <Button type="submit" size="sm" loading={pending} disabled={!ready}>
                    <CalendarPlus aria-hidden="true" />
                    {registration ? "Salvar lead e agendar" : "Agendar prova"}
                  </Button>
                </div>
              </div>
              {message && (
                <p role="alert" className="text-caption text-destructive">
                  {message}
                </p>
              )}
              {(save.error || registration?.error) && (
                <Alert variant="destructive">{save.error?.message ?? registration?.error}</Alert>
              )}
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
