import { useEffect, useState } from "react";
import { Button, Popover, PopoverTrigger, PopoverContent } from "@lazuli/ui";
import { scheduleLabel, weekdays } from "~/features/semester-organization/shared";
import { rowsFor, type ClassPlan, type SemesterBoard } from "./model";
import s from "./organization.module.css";

/** Recurring class composition, grouped by time; height does not encode lesson duration. */
export function WeeklySchedule({
  board,
  query,
  selected,
  onSelect,
}: {
  board: SemesterBoard;
  query: string;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const [day, setDay] = useState("all");
  const plans = board.plans.filter((plan) =>
    `${plan.name} ${plan.teacherName ?? ""} ${plan.stageCode ?? ""}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const activeDays = Object.entries(weekdays).filter(([key]) =>
    board.plans.some((plan) => plan.slots.some((slot) => slot.weekday === key)),
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
      {day === "all" && (
        <p className={s.weekHint}>Deslize a grade para ver os outros dias, ou selecione um dia.</p>
      )}
      <div className={s.weeklyScroll}>
        {times.length ? (
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
}) {
  const rows = rowsFor(board, plan.id);
  const waiting = rows.filter((row) => !row.publishedAt).length;
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={400}
        render={
          <button
            type="button"
            className={s.weeklyCard}
            data-ppt={plan.scheduleType === "PERSONALIZED"}
            data-selected={selected}
            onClick={() => onSelect(plan.id)}
            aria-label={`${plan.name}, ${plan.teacherName ?? "professor a definir"}, ${rows.length} ${rows.length === 1 ? "aluno" : "alunos"}`}
          />
        }
      >
        <span className={s.row}>
          <strong>
            {plan.scheduleType === "PERSONALIZED" ? "PPT" : (plan.stageCode ?? plan.name)}
          </strong>
          <span className={rows.length < 4 ? s.attention : s.small}>
            {rows.length} {rows.length === 1 ? "aluno" : "alunos"}
            {rows.length < 4 ? " · atenção" : ""}
          </span>
        </span>
        <span className={s.row}>
          <span className={s.weeklyTeacher}>{plan.teacherName ?? "Professor a definir"}</span>
          {plan.format === "ONLINE" && <span className={s.small}>Online</span>}
        </span>
      </PopoverTrigger>
      <PopoverContent side="right" size="md">
        <div className={s.diffDetails}>
          <strong>{plan.name}</strong>
          <p>{scheduleLabel(plan.slots)}</p>
          <p>
            {plan.teacherName ?? "Professor a definir"} ·{" "}
            {plan.format === "ONLINE" ? "Online" : "Presencial"}
          </p>
          <p>
            {rows.length} alunos · {waiting} alocações a confirmar
          </p>
          {plan.draftConflicts.length > 0 && (
            <p className={s.attention}>
              Professor também previsto em: {plan.draftConflicts.join(", ")}
            </p>
          )}
          <Button size="sm" variant="secondary" onClick={() => onSelect(plan.id)}>
            Organizar alunos desta turma
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
