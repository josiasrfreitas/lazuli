import type { JSX as ReactJSX } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@lazuli/ui";
import { dateLabel, type Planning } from "./shared";
import { planningPosition } from "./progress-model";
import { PlanningBand } from "./planning-band";
import styles from "./planning.module.css";

export function ProgressSummary({
  data,
  onRecords,
}: {
  data: Planning;
  onRecords: () => void;
}): ReactJSX.Element {
  const items = data.plan?.items ?? [];
  const position = planningPosition(items, { records: data.records, today: data.scope.today });
  const latestStep = data.records.find((row) => row.content.planItemId);
  return (
    <section className={styles.progress} aria-label="Progresso previsto e registrado">
      <PlanningBand
        items={items}
        date={data.scope.today}
        actualId={latestStep?.content.planItemId}
      />
      <div className={styles.progressFooter}>
        <div>
          {latestStep && (
            <p>
              {latestStep.content.planItemStatus === "COMPLETED"
                ? "Etapa concluída"
                : "Etapa em andamento"}{" "}
              · Registro de {dateLabel(latestStep.date)}
            </p>
          )}
          {position.actual !== null && (
            <p>
              Última página registrada: {position.actual}
              {position.expected !== null && ` · prevista: ${position.expected}`}
              {position.lastDate && ` · ${dateLabel(position.lastDate)}`}
            </p>
          )}
          {!latestStep && position.actual === null && (
            <p>Aguardando um registro de etapa ou páginas trabalhadas.</p>
          )}
        </div>
        <Button variant="link" size="sm" onClick={onRecords}>
          <BookOpen aria-hidden="true" />
          Consultar aulas
        </Button>
      </div>
    </section>
  );
}
