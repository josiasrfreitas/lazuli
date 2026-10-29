import type { ReactElement } from "react";
import { Badge } from "@lazuli/ui";
import { planMetrics } from "./confirmation";
import type { ClassPlan, OrganizationBoard } from "./model";
import styles from "./organization.module.css";

export function ClassMetrics({
  board,
  plan,
  compact = false,
}: {
  board: OrganizationBoard;
  plan: ClassPlan;
  compact?: boolean;
}): ReactElement {
  const metrics = planMetrics(board, plan);
  return (
    <span
      className={styles.classMetrics}
      data-compact={compact}
      role="list"
      aria-label="Composição da turma"
    >
      <span role="listitem">
        <Badge variant={metrics.confirmed ? "success" : "neutral"}>
          {metrics.confirmed} {compact ? "confirmados" : "alunos confirmados"}
        </Badge>
      </span>
      <span role="listitem">
        <Badge variant={metrics.pending ? "warning" : "neutral"}>
          {metrics.pending} {compact ? "a confirmar" : "alunos a confirmar"}
        </Badge>
      </span>
      <span role="listitem">
        <Badge variant={metrics.leads ? "info" : "neutral"}>
          {metrics.leads} {compact ? "leads" : "leads interessados"}
        </Badge>
      </span>
    </span>
  );
}
