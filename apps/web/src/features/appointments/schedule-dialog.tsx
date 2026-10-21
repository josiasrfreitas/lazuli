"use client";
import { ArrowRight, CalendarCheck, X } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { TaskDialog } from "~/features/shared/task-form";
import { today } from "./shared";
import { ClassMeetingStep } from "./class-meeting-step";
import { ScheduleDetails } from "./schedule-details";
import {
  useScheduleModel,
  changeScheduleDate,
  changeScheduleTeacher,
  chooseMeeting,
  type ScheduleProps,
  type ScheduleModel,
} from "./schedule-model";
import styles from "./schedule-dialog.module.css";
const DEFAULT_DURATION = 60;
export function ScheduleAppointmentDialog(props: ScheduleProps): ReactElement {
  const model = useScheduleModel(props);
  const classStep = model.draft.step === "schedule";
  return (
    <TaskDialog
      size={classStep ? "extra-wide" : "wide"}
      layout={classStep ? "calendar" : "expanded"}
      compactHeader={classStep}
      title={props.previous ? "Reagendar atendimento" : "Agendar atendimento"}
      description={scheduleDescription(model)}
      formId="appointment-schedule"
      firstField={scheduleFirstField(props)}
      pending={model.pending}
      onClose={props.onClose}
      onBack={classStep ? () => returnToDetails(model) : undefined}
      actionSize="sm"
      cancelIcon={<X aria-hidden="true" />}
      submitIcon={
        classStep ? <CalendarCheck aria-hidden="true" /> : <ArrowRight aria-hidden="true" />
      }
      submitDisabled={scheduleDisabled(model)}
      submitLabel={scheduleSubmitLabel(model)}
      error={model.saving.schedule.error?.message ?? model.saving.reschedule.error?.message}
      bodyRef={model.validation.body}
    >
      {(actions) => <ScheduleForm model={model} actions={actions} />}
    </TaskDialog>
  );
}
export function ScheduleForm({
  model,
  actions,
}: {
  model: ScheduleModel;
  actions: ReactNode;
}): ReactElement {
  const classStep = model.draft.step === "schedule";
  return (
    <form
      id="appointment-schedule"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        model.submit();
      }}
      className={classStep ? styles.scheduleLayout : styles.layout}
    >
      <fieldset
        disabled={model.pending}
        className={classStep ? styles.scheduleFields : styles.detailFields}
      >
        {classStep ? (
          <ScheduleMeeting model={model} actions={actions} />
        ) : (
          <ScheduleDetails model={model} />
        )}
      </fieldset>
      {!classStep && <div className="flex flex-wrap justify-end gap-3">{actions}</div>}
    </form>
  );
}
function ScheduleMeeting({
  model,
  actions,
}: {
  model: ScheduleModel;
  actions: ReactNode;
}): ReactElement {
  const { draft, eligibility } = model;
  return (
    <ClassMeetingStep
      actions={actions}
      durationMinutes={
        draft.purpose === "MAKEUP"
          ? draft.coverages.reduce((sum, row) => sum + row.minutes, 0)
          : DEFAULT_DURATION
      }
      kind={draft.kind}
      studentId={draft.student?.id ?? ""}
      previousId={model.props.previous?.id}
      teacher={eligibility.teacher}
      onTeacherChange={(value) => changeScheduleTeacher(model, value)}
      date={eligibility.parsedDate ?? today()}
      startTime={draft.startTime}
      endTime={draft.endTime}
      format={draft.format}
      sessionId={draft.sessionId}
      onDateChange={(value) => changeScheduleDate(model, value)}
      onSelect={(value) => chooseMeeting(model, value)}
      onStartChange={(value) => {
        model.setSelectionReady(false);
        model.edit({ startTime: value });
      }}
      onEndChange={(value) => {
        model.setSelectionReady(false);
        model.edit({ endTime: value });
      }}
      onFormatChange={(value) => model.edit({ format: value })}
      onReadyChange={model.setSelectionReady}
      error={eligibility.enrollmentDateError ?? model.validation.errors.meeting}
    />
  );
}
function scheduleDescription(model: ScheduleModel): string {
  if (model.draft.step === "schedule") return model.draft.student?.label ?? "Selecione um horário";
  return `${model.draft.student?.label ?? "Selecione o aluno para agendar."} · Etapa 1 de 2: atendimento`;
}
function scheduleFirstField(props: ScheduleProps): string {
  if (props.previous) return "appointment-kind";
  return props.student ? "appointment-purpose" : "appointment-student";
}
function scheduleSubmitLabel(model: ScheduleModel): string {
  if (model.draft.step === "details") return "Selecionar horário";
  return model.props.previous ? "Confirmar reagendamento" : "Agendar atendimento";
}
function returnToDetails(model: ScheduleModel): void {
  model.edit({ step: "details" });
  requestAnimationFrame(() => document.querySelector<HTMLElement>("#appointment-kind")?.focus());
}

function scheduleDisabled(model: ScheduleModel): boolean {
  return (
    model.eligibility.unavailable ||
    (model.draft.step === "schedule" &&
      (!model.selectionReady || Boolean(model.eligibility.enrollmentDateError)))
  );
}
