"use client";

import { UserRoundPlus } from "lucide-react";
import { abbreviatedPersonName } from "~/lib/format";
import { visitLabels } from "~/features/admissions/labels";
import { purposes, statuses } from "~/features/appointments/shared";
import type { CalendarLesson } from "./calendar-model";
import { CalendarLessonButton } from "./calendar-lesson";
import styles from "./calendar-linked-lesson.module.css";

const shortPurposes = {
  MAKEUP: "Reposição",
  PPT_COMPLEMENT: "Compl. PPT",
  REINFORCEMENT: "Reforço",
  ASSESSMENT: "Avaliação",
} as const;

export function CalendarLinkedLesson({
  lesson,
  expanded,
  appointmentId,
  onToggle,
  onOpen,
  onOpenAppointment,
  onOpenExperimental,
}: {
  lesson: CalendarLesson;
  expanded: boolean;
  appointmentId: string | null;
  onToggle: () => void;
  onOpen: (lesson: CalendarLesson) => void;
  onOpenAppointment: (id: string) => void;
  onOpenExperimental: (id: string) => void;
}) {
  const appointments = lesson.appointments ?? [];
  const leads = lesson.leadGuests ?? [];
  const guestCount = appointments.length + leads.length;
  const panelId = `lesson-appointments-${lesson.id}`;
  return (
    <div className={styles.frame} data-expanded={expanded} data-modality={lesson.scheduleType}>
      <div className={styles.lessonMain}>
        <CalendarLessonButton lesson={lesson} expanded={false} onOpen={onOpen} />
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
      <div id={panelId} className={styles.panel} inert={!expanded} aria-hidden={!expanded}>
        <div className={styles.panelContent}>
          <span className={styles.heading}>Convidados</span>
          <div className={styles.names}>
            {appointments.map((item) => (
              <button
                key={item.id}
                id={`appointment-cell-${item.id}`}
                type="button"
                className={styles.person}
                data-status={item.status}
                aria-haspopup="dialog"
                aria-expanded={appointmentId === item.id}
                aria-label={`${item.student.name} · ${purposes[item.purpose]} · ${statuses[item.status]}`}
                title={`${item.student.name} · ${purposes[item.purpose]} · ${statuses[item.status]}`}
                onClick={() => onOpenAppointment(item.id)}
              >
                <span>{abbreviatedPersonName(item.student.name)}</span>
                <span className={styles.purpose}>
                  {item.status === "CANCELLED"
                    ? "Cancelado"
                    : item.status === "NO_SHOW"
                      ? "Não veio"
                      : shortPurposes[item.purpose]}
                </span>
              </button>
            ))}
            {leads.map((visit) => (
              <button
                key={`experimental-${visit.id}`}
                type="button"
                className={styles.person}
                aria-label={`${visit.candidate.fullName} · Experimental em uma turma · ${visitLabels[visit.status]}`}
                title={`${visit.candidate.fullName} · Experimental em uma turma · ${visitLabels[visit.status]}`}
                aria-haspopup="dialog"
                onClick={() => onOpenExperimental(visit.id)}
              >
                <span>{abbreviatedPersonName(visit.candidate.fullName)}</span>
                <span className={styles.purpose}>Experimental</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
