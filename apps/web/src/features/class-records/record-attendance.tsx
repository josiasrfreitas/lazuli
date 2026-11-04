"use client";

import type { JSX as ReactJSX } from "react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import {
  Check,
  ChevronRight,
  CircleDashed,
  ListFilter,
  Search,
  UserRoundPlus,
  X,
} from "lucide-react";
import { Avatar, Button, Input } from "@lazuli/ui";
import type { ClassRecord } from "./shared";
import {
  lessonParticipants,
  type LessonParticipant,
  type ParticipantStatus,
} from "./record-participants";
import styles from "./class-record-dialog.module.css";

const ATTENDANCE_SEARCH_THRESHOLD = 8;
const STATUS = {
  present: { label: "Presente", icon: Check },
  absent: { label: "Falta", icon: X },
  pending: { label: "Sem registro", icon: CircleDashed },
  cancelled: { label: "Cancelada", icon: X },
};
const searchKey = (value: string): string =>
  value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

type AttendanceProps = {
  data: ClassRecord;
  compactHeading?: boolean;
  content?: ReactNode;
  teacher?: boolean;
  onAppointment: (id: string) => void;
  onExperimental: (id: string) => void;
};
export function RecordAttendance({
  data,
  onAppointment,
  onExperimental,
  teacher = false,
  compactHeading = false,
  content,
}: AttendanceProps): ReactJSX.Element {
  const headingId = useId();
  const [search, setSearch] = useState("");
  const [guestsOnly, setGuestsOnly] = useState(false);
  const participants = lessonParticipants(data);
  const guests = participants.filter((person) => person.kind !== "student").length;
  const visible = filterParticipants(participants, { search, guestsOnly });
  return (
    <section className={styles.attendance} aria-labelledby={headingId}>
      <AttendanceHeading
        compact={compactHeading}
        headingId={headingId}
        participants={participants}
        guests={guests}
        search={search}
        guestsOnly={guestsOnly}
        setSearch={setSearch}
        setGuestsOnly={setGuestsOnly}
      />
      {content}
      {visible.length > 0 ? (
        <AttendanceRoster
          visible={visible}
          teacher={teacher}
          onAppointment={onAppointment}
          onExperimental={onExperimental}
        />
      ) : (
        <AttendanceEmpty
          hasParticipants={participants.length > 0}
          filtered={Boolean(search || guestsOnly)}
          clear={() => {
            setSearch("");
            setGuestsOnly(false);
          }}
        />
      )}
    </section>
  );
}

function filterParticipants(
  participants: LessonParticipant[],
  { search, guestsOnly }: { search: string; guestsOnly: boolean },
): LessonParticipant[] {
  const normalizedSearch = searchKey(search);
  return participants.filter(
    (person) =>
      (!guestsOnly || person.kind !== "student") &&
      searchKey(person.name).includes(normalizedSearch),
  );
}

type HeadingProps = {
  compact: boolean;
  headingId: string;
  participants: LessonParticipant[];
  guests: number;
  search: string;
  guestsOnly: boolean;
  setSearch: (value: string) => void;
  setGuestsOnly: (value: boolean) => void;
};
function AttendanceHeading({
  compact,
  headingId,
  participants,
  guests,
  search,
  guestsOnly,
  setSearch,
  setGuestsOnly,
}: HeadingProps): ReactJSX.Element {
  return (
    <div className={styles.listHeading} data-compact={compact || undefined}>
      <div className={styles.sectionHeading}>
        <h2 id={headingId}>
          {guests ? "Alunos e convidados" : "Alunos"}
          <span>{participants.length}</span>
        </h2>
        <AttendanceSummary participants={participants} />
      </div>
      {(participants.length > ATTENDANCE_SEARCH_THRESHOLD ||
        guests > 0 ||
        search ||
        guestsOnly) && (
        <div className={styles.listControls}>
          <div className={styles.search}>
            <Input
              type="search"
              leadingIcon={<Search aria-hidden="true" />}
              size="sm"
              aria-label="Buscar aluno ou convidado"
              placeholder="Buscar pelo nome"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {guests > 0 && (
            <Button
              size="sm"
              variant={guestsOnly ? "secondary" : "ghost"}
              aria-pressed={guestsOnly}
              onClick={() => setGuestsOnly(!guestsOnly)}
            >
              <UserRoundPlus aria-hidden="true" /> Convidados · {guests}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function AttendanceSummary({
  participants,
}: {
  participants: LessonParticipant[];
}): ReactJSX.Element {
  return (
    <div className={styles.attendanceSummary} aria-label="Resumo de presença">
      {(["present", "absent", "pending"] as const).map((status) => {
        const total = participants.filter((person) => person.status === status).length;
        if (!total) return null;
        return (
          <span key={status} data-status={status}>
            <strong>{total}</strong> {statusLabel(status, total)}
          </span>
        );
      })}
    </div>
  );
}

function statusLabel(status: ParticipantStatus, total: number): string {
  if (status === "present") return total === 1 ? "presente" : "presentes";
  if (status === "absent") return total === 1 ? "falta" : "faltas";
  return "sem registro";
}

function AttendanceRoster({
  visible,
  teacher,
  onAppointment,
  onExperimental,
}: {
  visible: LessonParticipant[];
  teacher: boolean;
  onAppointment: (id: string) => void;
  onExperimental: (id: string) => void;
}): ReactJSX.Element {
  return (
    <ul className={styles.roster}>
      {visible.map((person) => (
        <li key={person.key}>
          {person.kind === "student" ? (
            <Link
              className={styles.participant}
              href={`${teacher ? "/professor" : ""}/alunos/${person.id}`}
            >
              <ParticipantContent person={person} />
            </Link>
          ) : (
            <button
              type="button"
              className={styles.participant}
              aria-haspopup="dialog"
              id={person.kind === "appointment" ? `appointment-cell-${person.id}` : undefined}
              onClick={() =>
                person.kind === "appointment" ? onAppointment(person.id) : onExperimental(person.id)
              }
            >
              <ParticipantContent person={person} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function AttendanceEmpty({
  hasParticipants,
  filtered,
  clear,
}: {
  hasParticipants: boolean;
  filtered: boolean;
  clear: () => void;
}): ReactJSX.Element {
  return (
    <div className={styles.empty} role="status">
      <p>
        {hasParticipants
          ? "Nenhum nome corresponde a este filtro."
          : "Nenhum aluno previsto para esta aula."}
      </p>
      {filtered && (
        <Button size="sm" variant="link" onClick={clear}>
          <ListFilter aria-hidden="true" /> Limpar filtro
        </Button>
      )}
    </div>
  );
}

function ParticipantContent({ person }: { person: LessonParticipant }): ReactJSX.Element {
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
