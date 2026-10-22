"use client";

import type { JSX } from "react";
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
} from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import { parseDateBR } from "~/lib/masks";
import { SelectControl, TextControl } from "~/features/classes/form-controls";
import { MeetingDateField } from "~/features/appointments/form-fields";
import { TeacherPicker } from "~/features/teachers/teacher-picker";
import { TimeField } from "~/features/shared/time-field";
import { DiscardRegistrationDialog } from "~/features/shared/discard-registration-dialog";
import { InterestChoice } from "./candidate-fields";
import { formatLabel } from "./labels";
import type { VisitCalendarData, VisitViewProps } from "./visit-dialog";
import styles from "./visit-dialog.module.css";

export function TrialVisitDialogView({
  input,
  state,
  calendar,
  validation,
  actions,
}: VisitViewProps): JSX.Element {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) actions.requestClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="h-[85dvh] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[1224px]">
          <DialogHeader className="flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
            <DialogTitle>
              {input.previousVisitId ? "Remarcar experimental" : "Agendar experimental"}
            </DialogTitle>
            <DialogDescription>{input.candidate.fullName}</DialogDescription>
          </DialogHeader>
          <DialogBody ref={actions.errors.body} className="flex min-h-0 flex-col overflow-hidden">
            <VisitForm {...{ input, state, calendar, validation, actions }} />
          </DialogBody>
        </DialogContent>
        {state.discarding && (
          <DiscardRegistrationDialog
            onKeep={() => state.setDiscarding(false)}
            onDiscard={input.onClose}
          />
        )}
      </DialogPortal>
    </Dialog>
  );
}

function VisitForm(props: VisitViewProps): JSX.Element {
  const { state, validation, actions } = props;
  const { errors, save } = actions;
  return (
    <form
      id="trial-schedule"
      className={styles.form}
      noValidate
      onSubmit={actions.submit}
      onChangeCapture={() => state.setDirty(true)}
    >
      <VisitFilters {...props} />
      <p className="text-caption text-muted-foreground">
        {state.kind === "TRIAL"
          ? "Selecione uma aula no calendário. O formato e o professor são os da turma."
          : "Escolha o professor e clique ou arraste em um horário livre. O formato vale apenas para esta aula."}
      </p>
      <VisitCalendarSection {...props} />
      <VisitFooter {...props} />
      {(validation.selectionError || errors.fields.schedule) && (
        <p role="alert" className="text-caption text-destructive">
          {validation.selectionError || errors.fields.schedule}
        </p>
      )}
      {save.error && <Alert variant="destructive">{save.error.message}</Alert>}
    </form>
  );
}

function VisitFilters(props: VisitViewProps): JSX.Element {
  const { state, calendar, actions } = props;
  return (
    <fieldset disabled={actions.save.isPending} className={styles.filters}>
      <VisitKindChoice {...props} />
      {state.kind === "TRIAL" ? (
        <SelectControl
          name="trial-class"
          label="Turma"
          value={state.classFilter}
          choices={[{ value: "ALL", label: "Todas as turmas" }, ...calendar.classOptions]}
          onChange={(value) => {
            state.setClassFilter(value);
            actions.resetSelection();
          }}
        />
      ) : (
        <VisitTeacherFields {...props} />
      )}
      <TextControl
        name="trial-notes"
        label="Orientações (opcional)"
        placeholder="O que preparar para a aula"
        value={state.notes}
        onChange={state.setNotes}
        error={actions.errors.fields.notes}
      />
    </fieldset>
  );
}

function VisitKindChoice({ state, actions }: VisitViewProps): JSX.Element {
  return (
    <InterestChoice
      label="Como será a aula?"
      value={state.kind}
      options={{ TRIAL: "Em uma turma", INTRODUCTION: "Individual" }}
      onChange={(value) => {
        state.setDirty(true);
        state.setKind(value as typeof state.kind);
        state.setView(value === "TRIAL" ? "day" : "week");
        actions.resetSelection();
      }}
    />
  );
}

function VisitTeacherFields({ state, validation, actions }: VisitViewProps): JSX.Element {
  return (
    <>
      <TeacherPicker
        date={validation.individual?.date ?? state.date}
        value={state.teacher}
        onChange={(value) => {
          state.setDirty(true);
          state.setTeacher(value);
          actions.resetSelection();
        }}
        error={actions.errors.fields["meeting.teacherId"] ?? null}
      />
      <InterestChoice
        label="Formato da aula"
        value={state.format}
        options={{ IN_PERSON: "Presencial", ONLINE: "Online" }}
        onChange={(value) => {
          state.setDirty(true);
          state.setFormat(value as typeof state.format);
        }}
      />
    </>
  );
}

function calendarStatus(calendar: VisitCalendarData): "loading" | "error" | "ready" {
  if (calendar.query.isFetching || calendar.query.isPending) return "loading";
  if (calendar.query.isError) return "error";
  return "ready";
}

function emptyMessage({ state }: VisitViewProps): string {
  if (state.kind === "TRIAL")
    return "Nenhuma aula futura neste período. Escolha outra data ou turma.";
  return state.teacher
    ? "Escolha um horário livre para a experimental."
    : "Selecione o professor para consultar a agenda.";
}

function VisitCalendarSection(props: VisitViewProps): JSX.Element {
  const { state, calendar, validation, actions } = props;
  return (
    <div className={styles.calendar}>
      <ScheduleCalendar
        {...calendar.window}
        label="Agenda da aula experimental"
        events={validation.events}
        density="compact"
        dateLabel={state.view === "day" ? formatDateOnlyBR(state.date) : undefined}
        hours={{ start: validation.times[0]!, end: validation.times.at(-1)! }}
        status={calendarStatus(calendar)}
        onRetry={() => void calendar.query.refetch()}
        onDateChange={actions.navigate}
        onViewChange={(value) => {
          state.setView(value);
          actions.resetSelection();
        }}
        selectedEventId={state.meetingId}
        onEventActivate={(event) => {
          if (!actions.save.isPending && state.kind === "TRIAL") {
            state.setDirty(true);
            state.setMeetingId(event.id);
            actions.errors.clear("schedule");
            actions.save.reset();
          }
        }}
        emptyMessage={emptyMessage(props)}
        rangeSelection={
          state.kind === "INTRODUCTION" && state.teacher
            ? {
                value: validation.ready ? validation.individual : null,
                onSelect: actions.selectRange,
                clickDurationMinutes: 60,
                minimum: state.now,
                blocked: calendar.blocked,
                getError: validation.checkInterval,
                controls: <></>,
              }
            : undefined
        }
      />
    </div>
  );
}

function VisitFooter(props: VisitViewProps): JSX.Element {
  const { state, calendar } = props;
  return (
    <div className={styles.footer}>
      {state.kind === "INTRODUCTION" ? (
        <VisitTimes {...props} />
      ) : (
        <p className="min-w-0 text-sm">
          {calendar.chosen
            ? `${calendar.chosen.className} · ${formatDateOnlyBR(calendar.chosen.date)} · ${calendar.chosen.startTime}–${calendar.chosen.endTime} · ${formatLabel(calendar.chosen.format)}`
            : "Selecione uma aula para continuar."}
        </p>
      )}
      <VisitButtons {...props} />
    </div>
  );
}

function VisitTimes({ state, calendar, actions }: VisitViewProps): JSX.Element {
  return (
    <fieldset
      disabled={actions.save.isPending}
      className={styles.times}
      aria-label="Horário da experimental"
    >
      <MeetingDateField
        compact
        fluid
        minDate={state.now.date}
        value={state.draftDate}
        error={actions.errors.fields.date}
        onChange={(value) => {
          state.setDraftDate(value);
          actions.errors.clear("schedule");
          const parsed = parseDateBR(value);
          if (parsed && (parsed < calendar.period.from || parsed > calendar.period.through))
            state.setDate(parsed);
        }}
      />
      <TimeField
        name="trial-start"
        label="Início"
        placeholder="hh:mm"
        align="center"
        value={state.start}
        onChange={state.setStart}
        error={actions.errors.fields["meeting.startTime"]}
      />
      <TimeField
        name="trial-end"
        label="Término"
        placeholder="hh:mm"
        align="center"
        value={state.end}
        onChange={state.setEnd}
        error={actions.errors.fields["meeting.endTime"]}
      />
    </fieldset>
  );
}

function VisitButtons({ input, validation, actions }: VisitViewProps): JSX.Element {
  return (
    <div className={styles.actions}>
      <Button
        variant="secondary"
        size="sm"
        disabled={actions.save.isPending}
        onClick={actions.requestClose}
      >
        <X /> Cancelar
      </Button>
      <Button type="submit" size="sm" loading={actions.save.isPending} disabled={!validation.ready}>
        <CalendarPlus />
        {input.previousVisitId ? "Confirmar remarcação" : "Agendar experimental"}
      </Button>
    </div>
  );
}
