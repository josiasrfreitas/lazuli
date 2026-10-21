import type { ReactElement } from "react";
import { planningBand } from "@lazuli/domain";
import styles from "./planning-band.module.css";

const INNER_WIDTH = 220;
const LEFT_INSET = 10;
const STEP_CENTRE = 0.5;
const POSITION_LABELS = {
  WITHIN: "Dentro da faixa prevista",
  BEHIND: "Retomando etapas anteriores",
  AHEAD: "À frente da faixa prevista",
  UNKNOWN: "Etapa ainda não vinculada",
} as const;
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
  const label = POSITION_LABELS[band.position];
  const expected = band.items[band.expected];
  const actual = band.items[band.actual];
  return (
    <div className={styles.band}>
      <div className={styles.heading}>
        <h3>Progresso no planejamento</h3>
        <span data-position={band.position}>{label}</span>
      </div>
      <BandTrack band={band} label={label} />
      <dl className={styles.positions}>
        <div>
          <dt>Previsto</dt>
          <dd>{expected?.title ?? "Antes da primeira etapa"}</dd>
        </div>
        <div>
          <dt>{draft ? "Neste registro" : "Último registro"}</dt>
          <dd>{actual?.title ?? "Sem etapa informada"}</dd>
        </div>
      </dl>
      <p className={styles.caption}>
        Faixa de referência: um encontro planejado antes e um depois. Adiantar ou retomar uma etapa
        é permitido.
      </p>
    </div>
  );
}

type Band = ReturnType<typeof planningBand<Step>>;
function BandTrack({ band, label }: { band: Band; label: string }): ReactElement {
  const stepWidth = INNER_WIDTH / band.items.length;
  const stepX = (index: number): number => LEFT_INSET + (index + STEP_CENTRE) * stepWidth;
  return (
    <svg
      className={styles.track}
      viewBox="0 0 240 24"
      role="img"
      aria-label={`${label}. Faixa de referência entre as etapas ${band.lower + 1} e ${band.upper + 1}.`}
    >
      <line x1="10" x2="230" y1="12" y2="12" stroke="var(--border-strong)" strokeWidth="2" />
      <rect
        x={LEFT_INSET + band.lower * stepWidth}
        y="5"
        width={(band.upper - band.lower + 1) * stepWidth}
        height="14"
        rx="4"
        fill="var(--success-muted)"
      />
      {band.expected >= 0 && (
        <line
          x1={stepX(band.expected)}
          x2={stepX(band.expected)}
          y1="3"
          y2="21"
          stroke="var(--muted-foreground)"
          strokeWidth="2"
        />
      )}
      {band.actual >= 0 && (
        <circle
          cx={stepX(band.actual)}
          cy="12"
          r="5"
          fill="var(--interactive)"
          stroke="var(--card)"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}
