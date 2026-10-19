"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Check, ChevronRight, CircleDashed, UserRoundPlus, X } from "lucide-react";
import { Avatar, Button, Input } from "@lazuli/ui";
import type { ClassRecord } from "./shared";
import {
  lessonParticipants,
  type LessonParticipant,
  type ParticipantStatus,
} from "./record-participants";
import styles from "./class-record-dialog.module.css";

const STATUS = {
  present: { label: "Presente", icon: Check },
  absent: { label: "Falta", icon: X },
  pending: { label: "Sem registro", icon: CircleDashed },
  cancelled: { label: "Cancelada", icon: X },
};
const searchKey = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

export function RecordAttendance({
  data,
  onAppointment,
  onExperimental,
  teacher = false,
}: {
  data: ClassRecord;
  teacher?: boolean;
  onAppointment: (id: string) => void;
  onExperimental: (id: string) => void;
}) {
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
  const count = (status: ParticipantStatus) =>
    participants.filter((person) => person.status === status).length;
  return (
    <section className={styles.attendance} aria-labelledby={headingId}>
      <div className={styles.listHeading}>
        <div className={styles.sectionHeading}>
          <h2 id={headingId}>
            {guests ? "Alunos e convidados" : "Alunos"}
            <span>{participants.length}</span>
          </h2>
          <div className={styles.attendanceSummary} aria-label="Resumo de presença">
            {(["present", "absent", "pending"] as const).map((status) => {
              const total = count(status);
              if (!total) return null;
              const label =
                status === "present"
                  ? total === 1
                    ? "presente"
                    : "presentes"
                  : status === "absent"
                    ? total === 1
                      ? "falta"
                      : "faltas"
                    : "sem registro";
              return (
                <span key={status} data-status={status}>
                  <strong>{total}</strong> {label}
                </span>
              );
            })}
          </div>
        </div>
        {(participants.length > 8 || guests > 0 || search || guestsOnly) && (
          <div className={styles.listControls}>
            <div className={styles.search}>
              <Input
                type="search"
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
                <UserRoundPlus aria-hidden="true" />
                Convidados · {guests}
              </Button>
            )}
          </div>
        )}
      </div>
      {visible.length > 0 ? (
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
                    person.kind === "appointment"
                      ? onAppointment(person.id)
                      : onExperimental(person.id)
                  }
                >
                  <ParticipantContent person={person} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty} role="status">
          <p>
            {participants.length
              ? "Nenhum nome corresponde a este filtro."
              : "Nenhum aluno previsto para esta aula."}
          </p>
          {(search || guestsOnly) && (
            <Button
              size="sm"
              variant="link"
              onClick={() => {
                setSearch("");
                setGuestsOnly(false);
              }}
            >
              Limpar filtro
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function ParticipantContent({ person }: { person: LessonParticipant }) {
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
