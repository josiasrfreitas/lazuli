import { planningBand } from "@lazuli/domain";
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
  actualId?: string | null;
  draft?: boolean;
}) {
  const band = planningBand(items, date, actualId);
  if (!band.items.length) return null;
  const stepWidth = 220 / band.items.length;
  const x = (index: number) => 10 + (index + 0.5) * stepWidth;
  const label =
    band.position === "WITHIN"
      ? "Dentro da faixa prevista"
      : band.position === "BEHIND"
        ? "Retomando etapas anteriores"
        : band.position === "AHEAD"
          ? "À frente da faixa prevista"
          : "Etapa ainda não vinculada";
  const expected = band.items[band.expected];
  const actual = band.items[band.actual];
  return (
    <div className={styles.band}>
      <div className={styles.heading}>
        <h3>Progresso no planejamento</h3>
        <span data-position={band.position}>{label}</span>
      </div>
      <svg
        className={styles.track}
        viewBox="0 0 240 24"
        role="img"
        aria-label={`${label}. Faixa de referência entre as etapas ${band.lower + 1} e ${band.upper + 1}.`}
      >
        <line x1="10" x2="230" y1="12" y2="12" stroke="var(--border-strong)" strokeWidth="2" />
        <rect
          x={10 + band.lower * stepWidth}
          y="5"
          width={(band.upper - band.lower + 1) * stepWidth}
          height="14"
          rx="4"
          fill="var(--success-muted)"
        />
        {band.expected >= 0 && (
          <line
            x1={x(band.expected)}
            x2={x(band.expected)}
            y1="3"
            y2="21"
            stroke="var(--muted-foreground)"
            strokeWidth="2"
          />
        )}
        {band.actual >= 0 && (
          <circle
            cx={x(band.actual)}
            cy="12"
            r="5"
            fill="var(--interactive)"
            stroke="var(--card)"
            strokeWidth="2"
          />
        )}
      </svg>
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
