import type { ReactElement } from "react";
import { CalendarDays, CheckCheck, Info } from "lucide-react";
import { Badge, Tooltip, TooltipTrigger, TooltipContent } from "@lazuli/ui";
import { planningBand } from "@lazuli/domain";
import { formatDateOnlyBR } from "~/lib/format";
import styles from "./planning-band.module.css";

type Step = { id: string; plannedOn: string; title: string };
export function PlanningBand({
  items,
  date,
  actualId,
  draft = false,
}: {
  items: Step[];
  date: string;
  actualId?: string | null | undefined;
  draft?: boolean;
}): ReactElement | null {
  const band = planningBand(items, { date, actualItemId: actualId ?? null });
  if (band.items.length === 0) return null;
  const expected = band.items[band.expected];
  const actual = band.items[band.actual];
  const difference = bandDifference(band);
  const variant = bandVariant(difference);
  const label = bandLabel(difference);
  return (
    <div className={styles.band}>
      <div className={styles.heading}>
        <h3>Andamento da programação</h3>
        <div className={styles.status}>
          <Badge variant={variant}>{label}</Badge>
          <Tooltip>
            <TooltipTrigger
              render={<button type="button" aria-label="Como o andamento é calculado" />}
            >
              <Info aria-hidden="true" size={16} />
            </TooltipTrigger>
            <TooltipContent>
              A comparação usa a data prevista do conteúdo trabalhado e o conteúdo previsto até{" "}
              {formatDateOnlyBR(date)}, data desta aula. Não é uma contagem de faltas nem uma
              porcentagem de conteúdo concluído.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <dl className={styles.positions}>
        <div>
          <dt>
            <CalendarDays aria-hidden="true" size={16} /> Previsto até {formatDateOnlyBR(date)}
          </dt>
          <dd>{expected?.title ?? "Antes da primeira etapa"}</dd>
        </div>
        <div>
          <dt>
            <CheckCheck aria-hidden="true" size={16} />{" "}
            {draft ? "Neste registro" : "Última etapa trabalhada"}{" "}
          </dt>
          <dd>{actual?.title ?? "Sem etapa informada"}</dd>
        </div>
      </dl>
    </div>
  );
}

function bandVariant(difference: number | null): "neutral" | "warning" | "info" | "success" {
  if (difference === null) return "neutral";
  if (difference < 0) return "warning";
  if (difference > 0) return "info";
  return "success";
}
function bandLabel(difference: number | null): string {
  if (difference === null) return "Sem etapa registrada";
  if (difference === 0) return "Em dia";
  const magnitude = Math.abs(difference);
  return `${magnitude} ${magnitude === 1 ? "aula" : "aulas"} ${difference > 0 ? "à frente" : "atrás"}`;
}

function bandDifference(band: ReturnType<typeof planningBand<Step>>): number | null {
  const expected = band.items[band.expected];
  const actual = band.items[band.actual];
  if (!actual || !expected) return null;
  const dates = [...new Set(band.items.map((item) => item.plannedOn))];
  return dates.indexOf(actual.plannedOn) - dates.indexOf(expected.plannedOn);
}
