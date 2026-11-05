"use client";

import type { JSX as ReactJSX } from "react";
import { ArrowLeft, CalendarPlus, X } from "lucide-react";
import {
  ToastAlert,
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
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { SelectControl } from "~/features/classes/form-controls";
import { MeetingDateField } from "~/features/appointments/form-fields";
import { TimeField } from "~/features/shared/time-field";
import { DiscardRegistrationDialog } from "~/features/shared/discard-registration-dialog";
import { parseDateBR } from "~/lib/masks";
import { InterestChoice } from "./candidate-fields";
import type { ScheduleViewProps } from "./placement-schedule";
import styles from "./placement-schedule.module.css";

export function PlacementScheduleView({
  props,
  state,
  calendar,
  validation,
  actions,
}: ScheduleViewProps): ReactJSX.Element {
  const { candidate, onClose, registration } = props;
  const { discarding, setDiscarding } = state;
  const { errors, requestClose } = actions;
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
          className="h-[85dvh] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] md:w-[calc(100vw-2rem)] md:max-w-[1224px]"
          initialFocus={() => document.querySelector("#appointment-date")}
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
          <DialogBody ref={errors.body} className="flex min-h-0 flex-col overflow-hidden">
            <ScheduleForm {...{ props, state, calendar, validation, actions }} />
          </DialogBody>
        </DialogContent>
        {discarding && (
          <DiscardRegistrationDialog onKeep={() => setDiscarding(false)} onDiscard={onClose} />
        )}
      </DialogPortal>
    </Dialog>
  );
}

function calendarStatus(calendar: ScheduleViewProps["calendar"]): "loading" | "error" | "ready" {
  if (calendar.isFetching || calendar.isPending) return "loading";
  if (calendar.isError) return "error";
  return "ready";
}

function ScheduleForm({
  props,
  state,
  calendar,
  validation,
  actions,
}: ScheduleViewProps): ReactJSX.Element {
  const { registration } = props;
  const { save, submit, message } = actions;
  return (
    <form id="placement-schedule" noValidate onSubmit={submit} className={styles.form}>
      <p className="text-caption text-muted-foreground">
        Clique ou arraste na agenda para escolher o horário da prova. Escolha também quem fará a
        correção.
      </p>
      <ScheduleCalendarSection {...{ props, state, calendar, validation, actions }} />
      <ScheduleFooter {...{ props, state, calendar, validation, actions }} />
      {message && (
        <p role="alert" className="text-caption text-destructive">
          {message}
        </p>
      )}
      {(save.error || registration?.error) && (
        <ToastAlert variant="destructive">{save.error?.message ?? registration?.error}</ToastAlert>
      )}
    </form>
  );
}

function ScheduleCalendarSection({
  state,
  calendar,
  validation,
  actions,
}: ScheduleViewProps): ReactJSX.Element {
  const { now, setView } = state;
  const { calendarWindow, blocked, events } = calendar;
  const { selection, selectionError, times } = validation;
  const { navigate, selectRange } = actions;
  return (
    <div className={styles.calendar}>
      <ScheduleCalendar
        {...calendarWindow}
        label="Agenda para nivelamento"
        events={events}
        hours={{ start: times[0]!, end: times.at(-1)! }}
        density="compact"
        expandEvents={false}
        status={calendarStatus(calendar)}
        errorMessage="Não foi possível carregar a agenda do nivelamento."
        onRetry={calendar.retry}
        onDateChange={navigate}
        onViewChange={setView}
        emptyMessage="Escolha um horário para a prova de nivelamento."
        rangeSelection={{
          clickDurationMinutes: 40,
          value: selectionError ? null : selection,
          minimum: now,
          blocked,
          getError: validation.intervalError,
          controls: <></>,
          onSelect: selectRange,
        }}
      />
    </div>
  );
}

function ScheduleFooter({
  props,
  state,
  calendar,
  validation,
  actions,
}: ScheduleViewProps): ReactJSX.Element {
  return (
    <div className={styles.footer}>
      <ScheduleFields {...{ props, state, calendar, validation, actions }} />
      <CorrectionTeacher state={state} actions={actions} />
      <ScheduleButtons {...{ props, state, calendar, validation, actions }} />
    </div>
  );
}

function ScheduleFields({ state, calendar, actions }: ScheduleViewProps): ReactJSX.Element {
  const { now, setCalendarDate, draft } = state;
  const { period } = calendar;
  const { errors, pending, change } = actions;
  return (
    <fieldset disabled={pending} className={styles.selection} aria-label="Horário do nivelamento">
      <MeetingDateField
        compact
        fluid
        minDate={now.date}
        value={draft.date}
        error={errors.fields.date}
        onChange={(value) => {
          change("date", value);
          const date = parseDateBR(value);
          if (date && (date < period.from || date > period.through)) setCalendarDate(date);
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
  );
}

function CorrectionTeacher({
  state,
  actions,
}: Pick<ScheduleViewProps, "state" | "actions">): ReactJSX.Element {
  const teachers = trpc.teachers.options.useQuery({
    date: parseDateBR(state.draft.date) ?? state.now.date,
    search: "",
  });
  return (
    <fieldset disabled={actions.pending} className={styles.correction}>
      <SelectControl
        name="placement-teacher"
        label="Professor responsável pela correção"
        value={state.draft.teacherId}
        onChange={(id) => actions.change("teacherId", id)}
        choices={(teachers.data ?? []).map((teacher) => ({
          value: teacher.id,
          label: teacher.name,
        }))}
        error={actions.errors.fields.teacherId}
      />
      <p className="text-caption text-muted-foreground">
        Responsável por corrigir a prova, não por aplicá-la.
      </p>
      {teachers.isPending && (
        <p role="status" className="text-caption">
          Carregando professores…
        </p>
      )}
      {teachers.isError && (
        <Button variant="ghost" size="sm" onClick={() => void teachers.refetch()}>
          Tentar carregar professores novamente
        </Button>
      )}
    </fieldset>
  );
}

function ScheduleButtons({ props, validation, actions }: ScheduleViewProps): ReactJSX.Element {
  const { registration } = props;
  const { ready } = validation;
  const { pending, requestClose } = actions;
  return (
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
        <Button variant="secondary" size="sm" disabled={pending} onClick={registration.onDefer}>
          Salvar sem agendamento
        </Button>
      )}
      <Button type="submit" size="sm" loading={pending} disabled={!ready}>
        <CalendarPlus aria-hidden="true" />
        {registration ? "Salvar lead e agendar" : "Agendar prova"}
      </Button>
    </div>
  );
}
