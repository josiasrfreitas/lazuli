"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CalendarCheck } from "lucide-react";
import { ToastAlert, Button } from "@lazuli/ui";
import {
  useScheduleModel,
  type ScheduleDialogProps,
  type ScheduleModel,
} from "~/features/appointments/schedule-dialog-model";
import {
  ScheduleMeetingStep,
  ScheduleNatureFields,
  ScheduleNotesFields,
} from "~/features/appointments/schedule-dialog";
import styles from "./student-agenda.module.css";

const EXIT_ANIMATION_MS = 200;

export function StudentAgendaScheduling({
  calendar,
  onPendingChange,
  ...input
}: ScheduleDialogProps & {
  calendar: ReactNode;
  onPendingChange: (pending: boolean) => void;
}): ReactElement {
  const [closing, setClosing] = useState(false);
  const finish = useCallback(() => setClosing(true), []);
  const model = useScheduleModel({ ...input, onClose: finish }, "nature");
  const meeting = model.draft.values.step === "schedule";
  useEffect(() => {
    onPendingChange(model.submission.pending);
    return () => onPendingChange(false);
  }, [model.submission.pending, onPendingChange]);
  useEffect(() => {
    if (!closing) return;
    const delay = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : EXIT_ANIMATION_MS;
    const timer = globalThis.setTimeout(input.onClose, delay);
    return () => globalThis.clearTimeout(timer);
  }, [closing, input.onClose]);
  const sidebar = (fields?: ReactNode): ReactElement => (
    <ScheduleSidebar model={model} fields={fields} onClose={finish} />
  );
  return (
    <form
      id="student-agenda-schedule"
      className={styles.scheduleForm}
      data-presentation="sidebar"
      data-closing={closing || undefined}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        model.submission.submit();
      }}
    >
      {meeting ? (
        <ScheduleMeetingStep model={model} actions={null} renderSidebar={sidebar} />
      ) : (
        <div className={styles.workspace}>
          <div className={styles.browseCalendar}>{calendar}</div>
          {sidebar()}
        </div>
      )}
    </form>
  );
}

function ScheduleSidebar({
  model,
  fields,
  onClose,
}: {
  model: ScheduleModel;
  fields?: ReactNode;
  onClose: () => void;
}): ReactElement {
  const { draft, submission } = model;
  const meeting = draft.values.step === "schedule";
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      panel.current
        ?.querySelector<HTMLElement>(
          "input:not([disabled]), textarea:not([disabled]), button[aria-pressed]:not([disabled])",
        )
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [meeting]);
  return (
    <aside ref={panel} className={styles.sidebar} aria-labelledby="agenda-schedule-heading">
      <ScheduleSidebarHeader model={model} meeting={meeting} onClose={onClose} />
      <div ref={draft.validation.body} className={styles.sidebarBody} key={draft.values.step}>
        <fieldset disabled={submission.pending} className={styles.sidebarFields}>
          {meeting ? (
            <>
              {fields}
              <ScheduleNotesFields {...model} />
            </>
          ) : (
            <ScheduleNatureFields {...model} />
          )}
        </fieldset>
        {submission.error && <ToastAlert variant="destructive">{submission.error}</ToastAlert>}
      </div>
      <ScheduleSidebarFooter model={model} meeting={meeting} />
    </aside>
  );
}

function ScheduleSidebarHeader({
  model,
  meeting,
  onClose,
}: {
  model: ScheduleModel;
  meeting: boolean;
  onClose: () => void;
}): ReactElement {
  return (
    <header className={styles.sidebarHeader}>
      <Button variant="ghost" size="sm" disabled={model.submission.pending} onClick={onClose}>
        <ArrowLeft aria-hidden="true" /> Voltar à agenda
      </Button>
      <h2 id="agenda-schedule-heading">
        {model.input.previous ? "Reagendar atendimento" : "Novo atendimento"}
      </h2>
      <p>
        {meeting ? "Horário e detalhes" : "Natureza do atendimento"} · {meeting ? "2" : "1"} de 2
      </p>
    </header>
  );
}

function ScheduleSidebarFooter({
  model,
  meeting,
}: {
  model: ScheduleModel;
  meeting: boolean;
}): ReactElement {
  const { draft, submission, data } = model;
  return (
    <footer className={styles.sidebarActions}>
      {meeting && (
        <Button
          variant="ghost"
          size="sm"
          disabled={submission.pending}
          onClick={() => draft.change("step", "details")}
        >
          <ArrowLeft aria-hidden="true" /> Natureza
        </Button>
      )}
      <Button
        type="submit"
        size="sm"
        disabled={
          submission.pending ||
          data.unavailable ||
          (meeting && (!draft.values.selectionReady || Boolean(data.enrollmentDateError)))
        }
      >
        {meeting ? <CalendarCheck aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
        {submissionLabel(submission.pending, meeting)}
      </Button>
    </footer>
  );
}

function submissionLabel(pending: boolean, meeting: boolean): string {
  if (pending) return "Salvando…";
  return meeting ? "Confirmar atendimento" : "Escolher horário";
}
