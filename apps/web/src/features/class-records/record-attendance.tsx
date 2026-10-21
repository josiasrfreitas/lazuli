"use client";
import Link from "next/link";
import { useId, useState, type ReactElement } from "react";
import { Check, ChevronRight, CircleDashed, ListFilter, UserRoundPlus, X } from "lucide-react";
import { Avatar, Button, Input } from "@lazuli/ui";
import type { ClassRecord } from "./shared";
import {
  lessonParticipants,
  type LessonParticipant,
  type ParticipantStatus,
} from "./record-participants";
import styles from "./class-record-dialog.module.css";
const SEARCH_THRESHOLD = 8;
const STATUS = {
  present: { label: "Presente", icon: Check },
  absent: { label: "Falta", icon: X },
  pending: { label: "Sem registro", icon: CircleDashed },
  cancelled: { label: "Cancelada", icon: X },
};
type Props = { data: ClassRecord; teacher?: boolean; onAppointment: (id: string) => void };
type Roster = {
  headingId: string;
  participants: LessonParticipant[];
  guests: number;
  visible: LessonParticipant[];
  search: string;
  setSearch: (value: string) => void;
  guestsOnly: boolean;
  setGuestsOnly: (value: boolean) => void;
};
function searchKey(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}
function useRoster(data: ClassRecord): Roster {
  const headingId = useId();
  const [search, setSearch] = useState("");
  const [guestsOnly, setGuestsOnly] = useState(false);
  const participants = lessonParticipants(data);
  const guests = participants.filter((person) => person.kind !== "student").length;
  const visible = participants.filter(
    (person) =>
      (!guestsOnly || person.kind !== "student") &&
      searchKey(person.name).includes(searchKey(search)),
  );
  return { headingId, participants, guests, visible, search, setSearch, guestsOnly, setGuestsOnly };
}
export function RecordAttendance(props: Props): ReactElement {
  const roster = useRoster(props.data);
  return (
    <section className={styles.attendance} aria-labelledby={roster.headingId}>
      <div className={styles.listHeading}>
        <div className={styles.sectionHeading}>
          <h2 id={roster.headingId}>
            {roster.guests ? "Alunos e convidados" : "Alunos"}
            <span>{roster.participants.length}</span>
          </h2>
          <AttendanceTotals roster={roster} />
        </div>
        <RosterControls roster={roster} />
      </div>
      {roster.visible.length > 0 ? (
        <ul className={styles.roster}>
          {roster.visible.map((person) => (
            <li key={person.key}>
              <ParticipantItem person={person} props={props} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyRoster roster={roster} />
      )}
    </section>
  );
}
function AttendanceTotals({ roster }: { roster: Roster }): ReactElement {
  return (
    <div className={styles.attendanceSummary} aria-label="Resumo de presença">
      {(["present", "absent", "pending"] as const).map((status) => {
        const total = roster.participants.filter((person) => person.status === status).length;
        if (total === 0) return null;
        return (
          <span key={status} data-status={status}>
            <strong>{total}</strong> {summaryLabel(status, total)}
          </span>
        );
      })}
    </div>
  );
}
function summaryLabel(status: ParticipantStatus, total: number): string {
  if (status === "present") return total === 1 ? "presente" : "presentes";
  if (status === "absent") return total === 1 ? "falta" : "faltas";
  return "sem registro";
}
function RosterControls({ roster }: { roster: Roster }): ReactElement | null {
  if (
    !(
      roster.participants.length > SEARCH_THRESHOLD ||
      roster.guests > 0 ||
      roster.search ||
      roster.guestsOnly
    )
  )
    return null;
  return (
    <div className={styles.listControls}>
      <div className={styles.search}>
        <Input
          type="search"
          size="sm"
          aria-label="Buscar aluno ou convidado"
          placeholder="Buscar pelo nome"
          name="lesson-participant-search"
          autoComplete="off"
          value={roster.search}
          onChange={(event) => roster.setSearch(event.target.value)}
        />
      </div>
      {roster.guests > 0 && (
        <Button
          size="sm"
          variant={roster.guestsOnly ? "secondary" : "ghost"}
          aria-pressed={roster.guestsOnly}
          onClick={() => roster.setGuestsOnly(!roster.guestsOnly)}
        >
          <UserRoundPlus aria-hidden="true" />
          Convidados · {roster.guests}
        </Button>
      )}
    </div>
  );
}
function ParticipantItem({
  person,
  props,
}: {
  person: LessonParticipant;
  props: Props;
}): ReactElement {
  if (person.kind === "student")
    return (
      <Link
        className={styles.participant}
        href={`${props.teacher ? "/professor" : ""}/alunos/${person.id}`}
      >
        <ParticipantContent person={person} />
      </Link>
    );
  return (
    <button
      type="button"
      className={styles.participant}
      aria-haspopup="dialog"
      id={`appointment-cell-${person.id}`}
      onClick={() => props.onAppointment(person.id)}
    >
      <ParticipantContent person={person} />
    </button>
  );
}
function EmptyRoster({ roster }: { roster: Roster }): ReactElement {
  return (
    <div className={styles.empty} role="status">
      <p>
        {roster.participants.length > 0
          ? "Nenhum nome corresponde a este filtro."
          : "Nenhum aluno previsto para esta aula."}
      </p>
      {(roster.search || roster.guestsOnly) && (
        <Button
          size="sm"
          variant="link"
          onClick={() => {
            roster.setSearch("");
            roster.setGuestsOnly(false);
          }}
        >
          <ListFilter aria-hidden="true" />
          Limpar filtro
        </Button>
      )}
    </div>
  );
}
function ParticipantContent({ person }: { person: LessonParticipant }): ReactElement {
  const { icon: Icon, label } = STATUS[person.status];
  return (
    <>
      <span className={styles.person}>
        <Avatar name={person.name} colorKey={person.colorKey} size="sm" />
        <span className={styles.student}>
          <strong>{person.name}</strong>
          <span data-kind={person.kind}>{person.description}</span>
        </span>
      </span>
      <span className={styles.presence} data-status={person.status}>
        <Icon aria-hidden="true" />
        {label}
      </span>
      <ChevronRight className={styles.openIcon} aria-hidden="true" />
    </>
  );
}
