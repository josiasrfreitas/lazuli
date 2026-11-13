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
  if (!band.items.length) return null;
  const expected = band.items[band.expected];
  const actual = band.items[band.actual];
  const dates = [...new Set(band.items.map((item) => item.plannedOn))];
  const difference =
    actual && expected ? dates.indexOf(actual.plannedOn) - dates.indexOf(expected.plannedOn) : null;
  const magnitude = Math.abs(difference ?? 0);
  const variant =
    difference === null
      ? "neutral"
      : difference < 0
        ? "warning"
        : difference > 0
          ? "info"
          : "success";
  const label =
    difference === null
      ? "Sem etapa registrada"
      : difference === 0
        ? "Em dia"
        : `${magnitude} ${magnitude === 1 ? "aula" : "aulas"} ${difference > 0 ? "à frente" : "atrás"}`;
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
