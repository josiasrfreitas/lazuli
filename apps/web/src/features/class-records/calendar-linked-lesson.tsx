"use client";
import type { JSX as ReactJSX } from "react";
import { UserRoundPlus } from "lucide-react";
import { abbreviatedPersonName } from "~/lib/format";
import { visitLabels } from "~/features/admissions/labels";
import { purposes, appointmentStatus } from "~/features/appointments/shared";
import type { CalendarLesson } from "./calendar-model";
import { CalendarLessonButton } from "./calendar-lesson";
import styles from "./calendar-linked-lesson.module.css";

const shortPurposes = {
  MAKEUP: "Reposição",
  PPT_COMPLEMENT: "Compl. PPT",
  REINFORCEMENT: "Reforço",
  ASSESSMENT: "Avaliação",
} as const;
type LinkedProps = {
  lesson: CalendarLesson;
  expanded: boolean;
  appointmentId: string | null;
  onToggle: () => void;
  onOpen: (lesson: CalendarLesson) => void;
  onOpenAppointment: (id: string) => void;
  onOpenExperimental: (id: string) => void;
  personal?: boolean;
};

export function CalendarLinkedLesson({
  lesson,
  expanded,
  appointmentId,
  onToggle,
  onOpen,
  onOpenAppointment,
  onOpenExperimental,
  personal = false,
}: LinkedProps): ReactJSX.Element {
  const guestCount = (lesson.appointments?.length ?? 0) + (lesson.leadGuests?.length ?? 0);
  const panelId = `lesson-appointments-${lesson.id}`;
  return (
    <div className={styles.frame} data-expanded={expanded} data-modality={lesson.scheduleType}>
      <div className={styles.lessonMain}>
        <CalendarLessonButton
          lesson={lesson}
          expanded={false}
          onOpen={onOpen}
          personal={personal}
        />
      </div>
      <button
        type="button"
        className={styles.indicator}
        data-appointment-toggle
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={`${expanded ? "Recolher" : "Mostrar"} ${guestCount} ${guestCount === 1 ? "convidado" : "convidados"} à aula ${lesson.className}`}
        onClick={onToggle}
      >
        <UserRoundPlus aria-hidden="true" />
        <span>{guestCount}</span>
        <span className={styles.indicatorLabel}>
          {guestCount === 1 ? "convidado" : "convidados"}
        </span>
      </button>
      <CalendarGuestsPanel
        lesson={lesson}
        panelId={panelId}
        expanded={expanded}
        appointmentId={appointmentId}
        onOpenAppointment={onOpenAppointment}
        onOpenExperimental={onOpenExperimental}
      />
    </div>
  );
}

function CalendarGuestsPanel({
  lesson,
  panelId,
  expanded,
  appointmentId,
  onOpenAppointment,
  onOpenExperimental,
}: {
  lesson: CalendarLesson;
  panelId: string;
  expanded: boolean;
  appointmentId: string | null;
  onOpenAppointment: (id: string) => void;
  onOpenExperimental: (id: string) => void;
}): ReactJSX.Element {
  return (
    <div id={panelId} className={styles.panel} inert={!expanded} aria-hidden={!expanded}>
      <div className={styles.panelContent}>
        <span className={styles.heading}>Convidados</span>
        <div className={styles.names}>
          {(lesson.appointments ?? []).map((item) => (
            <AppointmentGuest
              key={item.id}
              item={item}
              expanded={appointmentId === item.id}
              onOpen={() => onOpenAppointment(item.id)}
            />
          ))}
          {(lesson.leadGuests ?? []).map((visit) => (
            <ExperimentalGuest
              key={`experimental-${visit.id}`}
              visit={visit}
              onOpen={() => onOpenExperimental(visit.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AppointmentGuest({
  item,
  expanded,
  onOpen,
}: {
  item: NonNullable<CalendarLesson["appointments"]>[number];
  expanded: boolean;
  onOpen: () => void;
}): ReactJSX.Element {
  const label = `${item.student.name} · ${purposes[item.purpose]} · ${appointmentStatus(item.status, Boolean(item.rescheduledToId))}`;
  let purpose: string = shortPurposes[item.purpose];
  if (item.status === "CANCELLED")
    purpose = appointmentStatus(item.status, Boolean(item.rescheduledToId));
  else if (item.status === "NO_SHOW") purpose = "Não veio";
  return (
    <button
      id={`appointment-cell-${item.id}`}
      type="button"
      className={styles.person}
      data-status={item.status}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-label={label}
      title={label}
      onClick={onOpen}
    >
      <span>{abbreviatedPersonName(item.student.name)}</span>
      <span className={styles.purpose}>{purpose}</span>
    </button>
  );
}

function ExperimentalGuest({
  visit,
  onOpen,
}: {
  visit: NonNullable<CalendarLesson["leadGuests"]>[number];
  onOpen: () => void;
}): ReactJSX.Element {
  const label = `${visit.candidate.fullName} · Experimental em uma turma · ${visitLabels[visit.status]}`;
  return (
    <button
      type="button"
      className={styles.person}
      aria-label={label}
      title={label}
      aria-haspopup="dialog"
      onClick={onOpen}
    >
      <span>{abbreviatedPersonName(visit.candidate.fullName)}</span>
      <span className={styles.purpose}>Experimental</span>
    </button>
  );
}
