import type { ReactElement } from "react";
import { ChevronDown, ChevronUp, Clock3, UserRound } from "lucide-react";
import { Badge, Button, EmptyState } from "@lazuli/ui";
import { scheduleLabel } from "./shared";
import { leavingFor, stageLabel, type ClassPlan, type OrganizationBoard } from "./model";
import { ClassMetrics } from "./class-metrics";
import styles from "./class-plan-list.module.css";

type Props = {
  board: OrganizationBoard;
  query: string;
  selected: string | null;
  onSelect: (id: string) => void;
  showClosed: boolean;
  renderExpansion: (plan: ClassPlan) => ReactElement;
};

export function ClassPlanList({
  board,
  query,
  selected,
  onSelect,
  showClosed,
  renderExpansion,
}: Props): ReactElement {
  const search = query.trim().toLocaleLowerCase("pt-BR");
  const plans = board.plans.filter(
    (plan) =>
      (showClosed || plan.active) &&
      `${plan.name} ${plan.teacherName ?? ""} ${plan.stageCode ?? ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(search),
  );
  return (
    <section className={styles.viewport} aria-label="Turmas do período" tabIndex={0}>
      {plans.length > 0 ? (
        <ul className={styles.list}>
          {plans.map((plan) => (
            <li className={styles.item} key={plan.id} data-expanded={selected === plan.id}>
              <ClassPlanSummary
                plan={plan}
                board={board}
                open={selected === plan.id}
                onSelect={onSelect}
              />
              {selected === plan.id && (
                <div
                  id={`class-plan-${plan.id}`}
                  role="region"
                  aria-label={`Detalhes de ${plan.name}`}
                >
                  {renderExpansion(plan)}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Nenhuma turma nesta seleção"
          description="Ajuste a busca ou crie uma turma para este período."
        />
      )}
    </section>
  );
}

function ClassPlanSummary({
  plan,
  board,
  open,
  onSelect,
}: {
  plan: ClassPlan;
  board: OrganizationBoard;
  open: boolean;
  onSelect: (id: string) => void;
}): ReactElement {
  const leaving = leavingFor(board, plan).length;
  return (
    <div className={styles.summary}>
      <div className={styles.identity}>
        <div className={styles.title}>
          <h2>{plan.name}</h2>
          <Badge variant="neutral">
            {plan.scheduleType === "PERSONALIZED" ? "PPT" : stageLabel(plan.stageCode)}
          </Badge>
          {!plan.active && <Badge variant="neutral">Encerrada</Badge>}
        </div>
        <PlanMetadata plan={plan} />
      </div>
      <div className={styles.metrics}>
        <ClassMetrics board={board} plan={plan} compact />
        {leaving > 0 && (
          <Badge variant="warning">
            {leaving} {leaving === 1 ? "possível saída" : "possíveis saídas"}
          </Badge>
        )}
      </div>
      <Button
        size="compact-responsive"
        variant="secondary"
        aria-expanded={open}
        aria-controls={open ? `class-plan-${plan.id}` : undefined}
        aria-label={`${open ? "Recolher" : "Ver alunos de"} ${plan.name}`}
        onClick={() => onSelect(plan.id)}
      >
        {open ? "Recolher" : "Ver alunos"}
        {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
      </Button>
    </div>
  );
}

function PlanMetadata({ plan }: { plan: ClassPlan }): ReactElement {
  return (
    <div className={styles.metadata}>
      <span>
        <UserRound size={14} aria-hidden="true" />
        <span className="sr-only">Professor: </span>
        {plan.teacherName ?? "Professor a definir"}
      </span>
      <span>
        <Clock3 size={14} aria-hidden="true" />
        {scheduleLabel(plan.slots) || "Horário a definir"}
      </span>
      <span>{plan.format === "ONLINE" ? "Online" : "Presencial"}</span>
    </div>
  );
}
