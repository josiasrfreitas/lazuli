"use client";

import type { JSX as ReactJSX } from "react";
import { CalendarDays, Check, MapPin, Video } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { ToastAlert, Button, PencilLoader } from "@lazuli/ui";
import { dayLabel } from "~/features/admissions/labels";
import styles from "./intake-schedule.module.css";

type Options = RouterOutputs["students"]["intakeOptions"];
type ClassChoice = Options["classes"][number];
type Slot = ClassChoice["slots"][number];
const GROUP_TONE_COUNT = 4;

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

function classCount(choice: ClassChoice): string {
  if (choice.future) return `${choice.enrolled} na fila`;
  return `${choice.enrolled} ${choice.enrolled === 1 ? "aluno" : "alunos"}`;
}

function classOptionLabel(choice: ClassChoice, slot: Slot | undefined): string {
  const schedule = slot
    ? `${dayLabel(slot.weekday)}, ${slot.startTime}–${slot.endTime}`
    : choice.slots
        .map((item) => `${dayLabel(item.weekday)}, ${item.startTime}–${item.endTime}`)
        .join("; ") || "Sem horário recorrente";
  const title = choice.scheduleType === "PERSONALIZED" ? "PPT" : choice.stageName;
  const format = choice.format === "ONLINE" ? "online" : "presencial";
  return `${title}, ${choice.teacherName}, ${format}, ${schedule}, ${classCount(choice)}`;
}

function ClassSchedule({
  choice,
  slot,
}: {
  choice: ClassChoice;
  slot?: Slot | undefined;
}): ReactJSX.Element {
  if (slot)
    return (
      <span className={styles.classTime}>
        {slot.startTime}–{slot.endTime}
      </span>
    );
  return (
    <span className={styles.classSchedule}>
      {choice.slots.length > 0
        ? choice.slots.map((item) => (
            <span key={`${item.weekday}:${item.startTime}`}>
              {dayLabel(item.weekday)} · {item.startTime}–{item.endTime}
            </span>
          ))
        : "Sem horário recorrente"}
    </span>
  );
}

function ClassOption({
  choice,
  slot,
  tone,
  selectedId,
  onSelect,
}: SelectionProps & {
  choice: ClassChoice;
  slot?: Slot;
  tone: number;
}): ReactJSX.Element {
  const selected = selectedId === choice.id;
  const personalized = choice.scheduleType === "PERSONALIZED";
  return (
    <button
      type="button"
      className={styles.classOption}
      data-group-tone={tone}
      aria-pressed={selected}
      aria-label={classOptionLabel(choice, slot)}
      onClick={() => onSelect(selected ? "" : choice.id)}
    >
      <span className={styles.classHeading}>
        <strong>{personalized ? choice.teacherName : choice.stageName}</strong>
        <span className={styles.classIndicators}>
          <span title={choice.format === "ONLINE" ? "Online" : "Presencial"}>
            {choice.format === "ONLINE" ? (
              <Video className="size-4" aria-hidden="true" />
            ) : (
              <MapPin className="size-4" aria-hidden="true" />
            )}
          </span>
          {selected && <Check className="size-4 shrink-0" aria-label="Selecionada" />}
        </span>
      </span>
      {!personalized && <span className={styles.classTeacher}>{choice.teacherName}</span>}
      <ClassSchedule choice={choice} slot={slot} />
      <span className={styles.classCount}>{classCount(choice)}</span>
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
          <ScheduleTable choices={choices} days={days} times={times} {...selection} />
        )}
        {unscheduled.length > 0 && (
          <section className={styles.unscheduled} aria-label="Turmas sem horário recorrente">
            <h4>Sem horário recorrente</h4>
            <div className={styles.unscheduledOptions}>
              {unscheduled.map((choice) => (
                <ClassOption
                  key={choice.id}
                  choice={choice}
                  tone={choices.indexOf(choice) % GROUP_TONE_COUNT}
                  {...selection}
                />
              ))}
            </div>
          </section>
        )}
      </div>
      <div className={styles.mobileClasses} role="group" aria-label="Escolher turma">
        {[...choices.filter((choice) => choice.slots.length > 0), ...unscheduled].map((choice) => (
          <ClassOption
            key={choice.id}
            choice={choice}
            tone={choices.indexOf(choice) % GROUP_TONE_COUNT}
            {...selection}
          />
        ))}
      </div>
    </>
  );
}

function ScheduleTable({
  choices,
  days,
  times,
  ...selection
}: SelectionProps & {
  choices: ClassChoice[];
  days: Slot["weekday"][];
  times: string[];
}): ReactJSX.Element {
  return (
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
          <ScheduleTimeRow key={time} choices={choices} days={days} time={time} {...selection} />
        ))}
      </tbody>
    </table>
  );
}

function ScheduleTimeRow({
  choices,
  days,
  time,
  ...selection
}: SelectionProps & {
  choices: ClassChoice[];
  days: Slot["weekday"][];
  time: string;
}): ReactJSX.Element {
  return (
    <tr>
      <th scope="row">{time}</th>
      {days.map((day) => (
        <ScheduleDayCell key={day} choices={choices} day={day} time={time} {...selection} />
      ))}
    </tr>
  );
}

function ScheduleDayCell({
  choices,
  day,
  time,
  ...selection
}: SelectionProps & {
  choices: ClassChoice[];
  day: Slot["weekday"];
  time: string;
}): ReactJSX.Element {
  const entries: { choice: ClassChoice; slot: Slot }[] = [];
  for (const choice of choices) {
    for (const slot of choice.slots) {
      if (slot.weekday === day && slot.startTime === time) entries.push({ choice, slot });
    }
  }
  return (
    <td>
      <div className={styles.timeOptions}>
        {entries.length > 0 ? (
          entries.map(({ choice, slot }) => (
            <ClassOption
              key={choice.id}
              choice={choice}
              slot={slot}
              tone={choices.indexOf(choice) % GROUP_TONE_COUNT}
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
}

export function IntakeClasses({
  data,
  entryPeriod,
  teacherId,
  pending,
  error,
  onRetry,
  ...selection
}: SelectionProps & {
  data: Options | undefined;
  entryPeriod: "CURRENT" | "NEXT";
  teacherId: string | null;
  pending: boolean;
  error: string | undefined;
  onRetry: () => void;
}): ReactJSX.Element {
  const choices = (data?.classes ?? []).filter(
    (choice) => !teacherId || choice.teacherId === teacherId,
  );
  return (
    <section className={styles.classes} aria-label="Escolha da turma" aria-busy={pending}>
      <div className={styles.classesHeading}>
        <div>
          <h3>Horários das turmas</h3>
        </div>
        <span>
          {data?.semester?.name ?? (entryPeriod === "NEXT" ? "Próximo período" : "Período atual")}
          {!pending &&
            !error &&
            ` · ${choices.length} ${choices.length === 1 ? "turma" : "turmas"}`}
        </span>
      </div>
      <div className={`${styles.classesContent} scrollbar-subtle`}>
        <ClassesContent
          data={data}
          choices={choices}
          pending={pending}
          error={error}
          onRetry={onRetry}
          entryPeriod={entryPeriod}
          {...selection}
        />
      </div>
    </section>
  );
}

function ClassesContent({
  data,
  entryPeriod,
  choices,
  pending,
  error,
  onRetry,
  ...selection
}: SelectionProps & {
  data: Options | undefined;
  entryPeriod: "CURRENT" | "NEXT";
  choices: ClassChoice[];
  pending: boolean;
  error: string | undefined;
  onRetry: () => void;
}): ReactJSX.Element {
  if (pending)
    return (
      <div className={styles.centeredState}>
        <PencilLoader label="Carregando turmas" />
      </div>
    );
  if (error)
    return (
      <div className={styles.centeredState}>
        <ToastAlert variant="destructive">
          {error}
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Tentar novamente
          </Button>
        </ToastAlert>
      </div>
    );
  if (choices.length > 0) return <RecurringSchedule choices={choices} {...selection} />;
  return (
    <div className={styles.centeredState}>
      <CalendarDays className="size-6 text-muted-foreground" aria-hidden="true" />
      <p>{emptyClassesMessage(Boolean(data?.semester), entryPeriod)}</p>
    </div>
  );
}

function emptyClassesMessage(hasSemester: boolean, entryPeriod: "CURRENT" | "NEXT"): string {
  if (hasSemester && entryPeriod === "NEXT")
    return "Nenhuma turma planejada nesta combinação. Você pode deixar a turma pendente.";
  if (hasSemester) return "Nenhuma turma nesta combinação. Você pode deixar a turma pendente.";
  return entryPeriod === "NEXT"
    ? "Não há próximo período cadastrado."
    : "Não há período vigente cadastrado.";
}
