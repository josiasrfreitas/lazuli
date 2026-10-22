import type { JSX as ReactJSX } from "react";
import { useEffect, useState } from "react";
import { Button } from "@lazuli/ui";
import { weekdays } from "~/features/semester-organization/shared";
import { leavingFor, occupancy, stageLabel, type ClassPlan, type SemesterBoard } from "./model";
import styles from "./organization.module.css";

const WEEKDAY_LABEL_LENGTH = 3;

/** Recurring class composition, grouped by time; height does not encode lesson duration. */
export function WeeklySchedule({
  board,
  query,
  selected,
  onSelect,
  showClosed,
}: {
  board: SemesterBoard;
  query: string;
  selected: string | null;
  onSelect: (id: string) => void;
  showClosed: boolean;
}): ReactJSX.Element {
  const [day, setDay] = useState("all");
  const plans = visiblePlans({ board, query, showClosed });
  const activeDays = Object.entries(weekdays).filter(([key]) =>
    plans.some((plan) => plan.slots.some((slot) => slot.weekday === key)),
  );
  const firstDay = activeDays[0]?.[0] ?? "all";
  useEffect(() => {
    if (globalThis.matchMedia("(max-width: 760px)").matches) setDay(firstDay);
  }, [firstDay]);
  const days = activeDays.filter(([key]) => day === "all" || key === day);
  const times = startTimes(plans, day);
  return (
    <WeeklyLayout
      board={board}
      plans={plans}
      activeDays={activeDays}
      days={days}
      times={times}
      day={day}
      setDay={setDay}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

function visiblePlans({
  board,
  query,
  showClosed,
}: {
  board: SemesterBoard;
  query: string;
  showClosed: boolean;
}): ClassPlan[] {
  return board.plans.filter(
    (plan) =>
      (showClosed || plan.active) &&
      `${plan.name} ${plan.teacherName ?? ""} ${plan.stageCode ?? ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
}

function startTimes(plans: ClassPlan[], day: string): string[] {
  return [
    ...new Set(
      plans.flatMap((plan) =>
        plan.slots
          .filter((slot) => day === "all" || slot.weekday === day)
          .map((slot) => slot.startTime),
      ),
    ),
  ].toSorted();
}

function WeeklyLayout({
  board,
  plans,
  activeDays,
  days,
  times,
  day,
  setDay,
  selected,
  onSelect,
}: {
  board: SemesterBoard;
  plans: ClassPlan[];
  activeDays: [string, string][];
  days: [string, string][];
  times: string[];
  day: string;
  setDay: (value: string) => void;
  selected: string | null;
  onSelect: (id: string) => void;
}): ReactJSX.Element {
  return (
    <div className={styles.weekly}>
      <WeeklyToolbar day={day} setDay={setDay} activeDays={activeDays} count={plans.length} />
      <div className={styles.occupancyLegend} aria-label="Faixas de ocupação">
        <span data-occupancy="destructive">Até 3 · poucos alunos</span>
        <span data-occupancy="warning">4–7 · em composição</span>
        <span data-occupancy="success">8+ · boa ocupação</span>
      </div>
      {day === "all" && (
        <p className={styles.weekHint}>
          Deslize a grade para ver os outros dias, ou selecione um dia.
        </p>
      )}
      <WeeklyGrid
        board={board}
        plans={plans}
        days={days}
        times={times}
        day={day}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}

function WeeklyToolbar({
  day,
  setDay,
  activeDays,
  count,
}: {
  day: string;
  setDay: (value: string) => void;
  activeDays: [string, string][];
  count: number;
}): ReactJSX.Element {
  return (
    <div className={styles.weeklyToolbar}>
      <div className={styles.dayControls}>
        <Button
          size="sm"
          variant={day === "all" ? "secondary" : "ghost"}
          aria-pressed={day === "all"}
          onClick={() => setDay("all")}
        >
          Semana
        </Button>
        {activeDays.map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={day === key ? "secondary" : "ghost"}
            aria-pressed={day === key}
            onClick={() => setDay(key)}
          >
            {label.slice(0, WEEKDAY_LABEL_LENGTH)}
          </Button>
        ))}
      </div>
      <span className={styles.small}>Horários recorrentes · {count} turmas</span>
    </div>
  );
}

function WeeklyGrid({
  board,
  plans,
  days,
  times,
  day,
  selected,
  onSelect,
}: {
  board: SemesterBoard;
  plans: ClassPlan[];
  days: [string, string][];
  times: string[];
  day: string;
  selected: string | null;
  onSelect: (id: string) => void;
}): ReactJSX.Element {
  return (
    <div className={styles.weeklyScroll}>
      {times.length > 0 ? (
        <table className={styles.weeklyTable} data-single={day !== "all"}>
          <WeekHeader days={days} />
          <tbody>
            {times.map((time) => (
              <WeekRow
                key={time}
                time={time}
                days={days}
                plans={plans}
                board={board}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyWeek />
      )}
    </div>
  );
}

function WeekHeader({ days }: { days: [string, string][] }): ReactJSX.Element {
  return (
    <thead>
      <tr>
        <th scope="col">Início</th>
        {days.map(([key, label]) => (
          <th scope="col" key={key}>
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function EmptyWeek(): ReactJSX.Element {
  return (
    <div className={styles.empty}>
      <h2>Nenhuma turma nesta seleção</h2>
      <p>Ajuste o dia ou a busca para encontrar os horários.</p>
    </div>
  );
}

function WeekRow({
  time,
  days,
  plans,
  board,
  selected,
  onSelect,
}: {
  time: string;
  days: [string, string][];
  plans: ClassPlan[];
  board: SemesterBoard;
  selected: string | null;
  onSelect: (id: string) => void;
}): ReactJSX.Element {
  return (
    <tr>
      <th scope="row">
        <time>{time}</time>
      </th>
      {days.map(([key]) => (
        <WeekCell
          key={key}
          weekday={key}
          time={time}
          plans={plans}
          board={board}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </tr>
  );
}

function WeekCell({
  weekday,
  time,
  plans,
  board,
  selected,
  onSelect,
}: {
  weekday: string;
  time: string;
  plans: ClassPlan[];
  board: SemesterBoard;
  selected: string | null;
  onSelect: (id: string) => void;
}): ReactJSX.Element {
  const matching = plans.filter((plan) =>
    plan.slots.some((slot) => slot.weekday === weekday && slot.startTime === time),
  );
  return (
    <td>
      <div className={styles.weeklyStack}>
        {matching.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            board={board}
            selected={selected === plan.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </td>
  );
}

function PlanCard({
  plan,
  board,
  selected,
  onSelect,
}: {
  plan: ClassPlan;
  board: SemesterBoard;
  selected: boolean;
  onSelect: (id: string) => void;
}): ReactJSX.Element {
  const health = occupancy(plan);
  const leaving = leavingFor(board, plan).length;
  const proposed = proposedCount(board, plan);
  return (
    <button
      type="button"
      className={styles.weeklyCard}
      data-occupancy={health.tone}
      data-selected={selected}
      data-closed={!plan.active}
      aria-pressed={selected}
      onClick={() => onSelect(plan.id)}
      aria-label={`${plan.name}, ${plan.teacherName ?? "professor a definir"}, ${health.count} alunos${leaving ? `, ${leaving} possíveis saídas` : ""}`}
    >
      <strong>
        {plan.scheduleType === "PERSONALIZED"
          ? "PPT · estágios individuais"
          : stageLabel(plan.stageCode)}
      </strong>
      <span className={styles.occupancy}>
        <b>{health.count}</b>
        <span>
          alunos
          <span className={styles.occupancyLabel}>{occupancyLabel(plan, health.label)}</span>
        </span>
      </span>
      {proposed > 0 && <span className={styles.small}>{proposed} em alocação</span>}
      <span className={styles.weeklyTeacher}>{plan.teacherName ?? "Professor a definir"}</span>
      {leaving > 0 && (
        <span className={`${styles.small} ${styles.attention}`}>
          {leaving} {leaving === 1 ? "possível saída" : "possíveis saídas"}
        </span>
      )}
      {plan.format === "ONLINE" && <span className={styles.small}>Online</span>}
    </button>
  );
}

function proposedCount(board: SemesterBoard, plan: ClassPlan): number {
  return (
    board.placements.filter((row) => row.planId === plan.id && !row.publishedAt && !row.declinedAt)
      .length + board.waitingLeads.filter((lead) => lead.allocationPlanId === plan.id).length
  );
}

function occupancyLabel(plan: ClassPlan, label: string): string {
  if (!plan.active) return "Encerrada";
  return plan.classId ? label : "Turma proposta";
}
