"use client";

import type { JSX as ReactJSX } from "react";
import { CalendarDays, Check } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { Alert, Button, PencilLoader } from "@lazuli/ui";
import { dayLabel } from "~/features/admissions/labels";
import styles from "./intake-schedule.module.css";

type Options = RouterOutputs["students"]["intakeOptions"];
type ClassChoice = Options["classes"][number];
type Slot = ClassChoice["slots"][number];

const WEEKDAYS: Slot["weekday"][] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

type SelectionProps = {
  selectedId: string;
  onSelect: (id: string) => void;
};

function ClassOption({
  choice,
  slot,
  selectedId,
  onSelect,
}: SelectionProps & {
  choice: ClassChoice;
  slot?: Slot;
}): ReactJSX.Element {
  const selected = selectedId === choice.id;
  const schedule = slot
    ? `${dayLabel(slot.weekday)}, ${slot.startTime}–${slot.endTime}`
    : choice.slots
        .map((item) => `${dayLabel(item.weekday)}, ${item.startTime}–${item.endTime}`)
        .join("; ") || "Sem horário recorrente";
  return (
    <button
      type="button"
      className={styles.classOption}
      aria-pressed={selected}
      aria-label={`${choice.name}, ${schedule}, ${choice.enrolled} ${choice.enrolled === 1 ? "aluno" : "alunos"}`}
      onClick={() => onSelect(choice.id)}
    >
      <span className={styles.classHeading}>
        <strong>{choice.name}</strong>
        {selected && <Check className="size-4 shrink-0" aria-label="Selecionada" />}
      </span>
      {slot ? (
        <span className={styles.classTime}>
          {slot.startTime}–{slot.endTime}
        </span>
      ) : (
        <span className={styles.classSchedule}>
          {choice.slots.length > 0
            ? choice.slots.map((item) => (
                <span key={`${item.weekday}:${item.startTime}`}>
                  {dayLabel(item.weekday)} · {item.startTime}–{item.endTime}
                </span>
              ))
            : "Sem horário recorrente"}
        </span>
      )}
      <span className={styles.classCount}>
        {choice.enrolled} {choice.enrolled === 1 ? "aluno" : "alunos"}
      </span>
    </button>
  );
}

function RecurringSchedule({
  choices,
  ...selection
}: SelectionProps & { choices: ClassChoice[] }): ReactJSX.Element {
  const days = WEEKDAYS.filter(
    (day) =>
      day !== "SUNDAY" ||
      choices.some((choice) => choice.slots.some((slot) => slot.weekday === day)),
  );
  const times = [
    ...new Set(choices.flatMap((choice) => choice.slots.map((slot) => slot.startTime))),
  ].toSorted();
  const unscheduled = choices.filter((choice) => choice.slots.length === 0);
  return (
    <>
      <div className={styles.weeklySchedule}>
        {times.length > 0 && (
          <table className={styles.weeklyTable}>
            <caption className="sr-only">Turmas por dia da semana e horário de início</caption>
            <thead>
              <tr>
                <th scope="col">Início</th>
                {days.map((day) => (
                  <th key={day} scope="col">
                    {dayLabel(day)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {times.map((time) => (
                <tr key={time}>
                  <th scope="row">{time}</th>
                  {days.map((day) => {
                    const entries = choices.flatMap((choice) =>
                      choice.slots
                        .filter((slot) => slot.weekday === day && slot.startTime === time)
                        .map((slot) => ({ choice, slot })),
                    );
                    return (
                      <td key={day}>
                        <div className={styles.timeOptions}>
                          {entries.length > 0 ? (
                            entries.map(({ choice, slot }) => (
                              <ClassOption
                                key={choice.id}
                                choice={choice}
                                slot={slot}
                                {...selection}
                              />
                            ))
                          ) : (
                            <span className={styles.emptyCell} aria-label="Sem turma">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {unscheduled.length > 0 && (
          <section className={styles.unscheduled} aria-label="Turmas sem horário recorrente">
            <h4>Sem horário recorrente</h4>
            <div className={styles.unscheduledOptions}>
              {unscheduled.map((choice) => (
                <ClassOption key={choice.id} choice={choice} {...selection} />
              ))}
            </div>
          </section>
        )}
      </div>
      <div className={styles.mobileClasses} role="group" aria-label="Escolher turma">
        {[...choices.filter((choice) => choice.slots.length > 0), ...unscheduled].map((choice) => (
          <ClassOption key={choice.id} choice={choice} {...selection} />
        ))}
      </div>
    </>
  );
}

export function IntakeClasses({
  data,
  pending,
  error,
  onRetry,
  ...selection
}: SelectionProps & {
  data: Options | undefined;
  pending: boolean;
  error: string | undefined;
  onRetry: () => void;
}): ReactJSX.Element {
  const choices = data?.classes ?? [];
  return (
    <section className={styles.classes} aria-label="Escolha da turma" aria-busy={pending}>
      <div className={styles.classesHeading}>
        <div>
          <h3>Horários das turmas</h3>
        </div>
        <span>
          {data?.semester?.name ?? "Semestre atual"}
          {!pending &&
            !error &&
            ` · ${choices.length} ${choices.length === 1 ? "turma" : "turmas"}`}
        </span>
      </div>
      <div className={`${styles.classesContent} scrollbar-subtle`}>
        {pending ? (
          <div className={styles.centeredState}>
            <PencilLoader label="Carregando turmas" />
          </div>
        ) : error ? (
          <div className={styles.centeredState}>
            <Alert variant="destructive">
              {error}
              <Button variant="secondary" size="sm" onClick={onRetry}>
                Tentar novamente
              </Button>
            </Alert>
          </div>
        ) : choices.length > 0 ? (
          <RecurringSchedule choices={choices} {...selection} />
        ) : (
          <div className={styles.centeredState}>
            <CalendarDays className="size-6 text-muted-foreground" aria-hidden="true" />
            <p>
              {data?.semester
                ? "Nenhuma turma nesta combinação. Altere os filtros ou deixe a turma para depois."
                : "Não há semestre vigente cadastrado."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
