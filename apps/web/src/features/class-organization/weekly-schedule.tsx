import type { JSX as ReactJSX } from "react";
import { useEffect, useState } from "react";
import { Button } from "@lazuli/ui";
import { weekdays } from "~/features/semester-organization/shared";
import { leavingFor, occupancy, stageLabel, type ClassPlan, type SemesterBoard } from "./model";
import s from "./organization.module.css";

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
  const plans = board.plans.filter(
    (plan) =>
      (showClosed || plan.active) &&
      `${plan.name} ${plan.teacherName ?? ""} ${plan.stageCode ?? ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const activeDays = Object.entries(weekdays).filter(([key]) =>
    plans.some((plan) => plan.slots.some((slot) => slot.weekday === key)),
  );
  const firstDay = activeDays[0]?.[0] ?? "all";
  useEffect(() => {
    if (window.matchMedia("(max-width: 760px)").matches) setDay(firstDay);
  }, [firstDay]);
  const days = activeDays.filter(([key]) => day === "all" || key === day);
  const times = [
    ...new Set(
      plans.flatMap((plan) =>
        plan.slots
          .filter((slot) => day === "all" || slot.weekday === day)
          .map((slot) => slot.startTime),
      ),
    ),
  ].sort();
  return (
    <div className={s.weekly}>
      <div className={s.weeklyToolbar}>
        <div className={s.dayControls}>
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
              {label.slice(0, 3)}
            </Button>
          ))}
        </div>
        <span className={s.small}>Horários recorrentes · {plans.length} turmas</span>
      </div>
      <div className={s.occupancyLegend} aria-label="Faixas de ocupação">
        <span data-occupancy="destructive">Até 3 · poucos alunos</span>
        <span data-occupancy="warning">4–7 · em composição</span>
        <span data-occupancy="success">8+ · boa ocupação</span>
      </div>
      {day === "all" && (
        <p className={s.weekHint}>Deslize a grade para ver os outros dias, ou selecione um dia.</p>
      )}
      <div className={s.weeklyScroll}>
        {times.length > 0 ? (
          <table className={s.weeklyTable} data-single={day !== "all"}>
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
            <tbody>
              {times.map((time) => (
                <tr key={time}>
                  <th scope="row">
                    <time>{time}</time>
                  </th>
                  {days.map(([key]) => (
                    <td key={key}>
                      <div className={s.weeklyStack}>
                        {plans
                          .filter((plan) =>
                            plan.slots.some(
                              (slot) => slot.weekday === key && slot.startTime === time,
                            ),
                          )
                          .map((plan) => (
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
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={s.empty}>
            <h2>Nenhuma turma nesta seleção</h2>
            <p>Ajuste o dia ou a busca para encontrar os horários.</p>
          </div>
        )}
      </div>
    </div>
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
  const proposed =
    board.placements.filter((row) => row.planId === plan.id && !row.publishedAt && !row.declinedAt)
      .length + board.waitingLeads.filter((lead) => lead.allocationPlanId === plan.id).length;
  return (
    <button
      type="button"
      className={s.weeklyCard}
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
      <span className={s.occupancy}>
        <b>{health.count}</b>
        <span>
          alunos
          <span className={s.occupancyLabel}>
            {plan.active ? (plan.classId ? health.label : "Turma proposta") : "Encerrada"}
          </span>
        </span>
      </span>
      {proposed > 0 && <span className={s.small}>{proposed} em alocação</span>}
      <span className={s.weeklyTeacher}>{plan.teacherName ?? "Professor a definir"}</span>
      {leaving > 0 && (
        <span className={`${s.small} ${s.attention}`}>
          {leaving} {leaving === 1 ? "possível saída" : "possíveis saídas"}
        </span>
      )}
      {plan.format === "ONLINE" && <span className={s.small}>Online</span>}
    </button>
  );
}
