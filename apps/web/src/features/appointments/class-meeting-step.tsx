"use client";
import type { ReactElement } from "react";
import {
  Field,
  Label,
  SegmentedControl,
  SegmentedControlItem,
  type CalendarRangeSelection,
} from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import { TimeField } from "~/features/shared/time-field";
import { MeetingDateField } from "./form-fields";
import { ScheduleCalendarToolbar } from "./schedule-calendar-toolbar";
import { AppointmentCalendar } from "./appointment-calendar";
import { BATCH_DAYS, useMeetingModel, type MeetingModel } from "./meeting-model";
import type { MeetingEvent, MeetingProps } from "./meeting-types";
import styles from "./class-meeting-step.module.css";
export type { ScheduleSelection } from "./meeting-types";
const DEFAULT_DURATION = 60;
type MeetingView = { props: MeetingProps; model: MeetingModel };

export function ClassMeetingStep(props: MeetingProps): ReactElement {
  const model = useMeetingModel(props);
  return (
    <div
      ref={model.calendar.step}
      tabIndex={-1}
      role="group"
      aria-label={props.kind === "CLASS" ? "Selecione uma aula" : "Selecione um horário livre"}
      className={styles.layout}
    >
      <ScheduleCalendarToolbar
        date={model.calendar.visibleDate}
        today={model.now.date}
        view={model.calendar.view}
        teacher={props.teacher}
        onTeacherChange={props.onTeacherChange}
        onDateChange={model.calendar.navigate}
        onViewChange={model.calendar.setView}
      />
      {!props.teacher && (
        <p role="status" className="text-caption text-muted-foreground">
          Selecione um professor para consultar a agenda.
        </p>
      )}
      <div className={styles.calendar}>
        <MeetingCalendar props={props} model={model} />
      </div>
      <div className={styles.footer}>
        {props.kind === "INDEPENDENT" ? (
          <IndependentFields props={props} model={model} />
        ) : (
          <ClassSelectionSummary model={model} />
        )}
        <div className={styles.actions}>{props.actions}</div>
      </div>
      {(model.manualError || props.error) && (
        <p role="alert" className={styles.error}>
          {model.manualError ?? props.error}
        </p>
      )}
    </div>
  );
}
function MeetingCalendar({ props, model }: MeetingView): ReactElement {
  const { calendar } = model;
  return (
    <AppointmentCalendar<MeetingEvent>
      collapseEmptyShifts={props.kind === "CLASS"}
      toolbar={false}
      date={calendar.visibleDate}
      view={calendar.view}
      dayCount={BATCH_DAYS}
      minDate={model.now.date}
      density="compact"
      expandEvents={false}
      label="Disponibilidade para atendimento"
      events={model.events}
      status={model.status}
      errorMessage="Não foi possível consultar a disponibilidade. Tente novamente."
      onRetry={() => void model.query.refetch()}
      onDateChange={calendar.navigate}
      onViewChange={calendar.setView}
      selectedEventId={
        props.kind === "CLASS" && props.sessionId ? `class-${model.selectedClass?.id}` : undefined
      }
      onEventActivate={(event) => {
        if (props.kind === "CLASS" && event.sessionId)
          props.onSelect({
            date: event.date,
            startTime: event.startTime,
            endTime: event.endTime,
            sessionId: event.sessionId,
            format: event.format,
          });
      }}
      emptyMessage={
        props.kind === "CLASS"
          ? "Nenhuma aula deste professor neste período."
          : "Período livre. Escolha um horário na agenda."
      }
      rangeSelection={meetingRangeSelection(props, model)}
    />
  );
}
function IndependentFields({ props, model }: MeetingView): ReactElement {
  return (
    <div className={styles.selection} aria-label="Horário do atendimento">
      <MeetingDateField
        compact
        fluid
        minDate={model.now.date}
        value={model.calendar.dateDraft}
        onChange={model.calendar.editDate}
      />
      <TimeField
        name="appointment-start"
        label="Início"
        placeholder="hh:mm"
        align="center"
        value={props.startTime}
        onChange={props.onStartChange}
      />
      <TimeField
        name="appointment-end"
        label="Fim"
        placeholder="hh:mm"
        align="center"
        value={props.endTime}
        onChange={props.onEndChange}
      />
      <MeetingFormat props={props} />
    </div>
  );
}
function MeetingFormat({ props }: { props: MeetingProps }): ReactElement {
  return (
    <div className={styles.format}>
      <Field>
        <Label id="appointment-format-label">Formato</Label>
        <SegmentedControl
          size="sm"
          aria-labelledby="appointment-format-label"
          value={props.format}
          onValueChange={(value) => {
            if (value === "IN_PERSON" || value === "ONLINE") props.onFormatChange(value);
          }}
        >
          <SegmentedControlItem value="IN_PERSON">Presencial</SegmentedControlItem>
          <SegmentedControlItem value="ONLINE">Online</SegmentedControlItem>
        </SegmentedControl>
      </Field>
    </div>
  );
}
function ClassSelectionSummary({ model }: { model: MeetingModel }): ReactElement {
  const selectedClass = model.selectedClass;
  return (
    <div className={styles.summary} aria-live="polite">
      {selectedClass ? (
        <>
          <strong>{selectedClass.className}</strong>
          <span>
            {formatDateOnlyBR(selectedClass.date)} · {selectedClass.startTime}–
            {selectedClass.endTime} · {selectedClass.format === "ONLINE" ? "Online" : "Presencial"}
          </span>
        </>
      ) : (
        <p className="text-muted-foreground">Selecione uma aula na agenda.</p>
      )}
    </div>
  );
}

function meetingRangeSelection(
  props: MeetingProps,
  model: MeetingModel,
): CalendarRangeSelection | undefined {
  if (props.kind !== "INDEPENDENT") return undefined;
  return {
    clickDurationMinutes: props.durationMinutes || DEFAULT_DURATION,
    value: props.startTime && props.endTime && !model.manualError ? model.selectedRange : null,
    minimum: model.now,
    blocked: model.blocked,
    getError: (range) => model.getError(range),
    onSelect: (range) => props.onSelect(range),
    controls: <></>,
  };
}
