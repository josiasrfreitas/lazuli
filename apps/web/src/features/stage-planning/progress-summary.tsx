import { Button } from "@lazuli/ui";
import { dateLabel, type Planning } from "./shared";
import { planningPosition } from "./progress-model";
import styles from "./planning.module.css";

export function ProgressSummary({ data, onRecords }: { data: Planning; onRecords: () => void }) {
  const position = planningPosition(data.plan?.items ?? [], data.records, data.scope.today);
  return (
    <section className={styles.progress} aria-label="Progresso previsto e registrado">
      <div className={styles.progressIntro}>
        <h3>Avanço no material</h3>
        <p>Posição em páginas · {dateLabel(data.scope.today)}</p>
      </div>
      <div className={styles.meters}>
        <PositionBar
          label="Previsto até hoje"
          value={position.expected}
          max={position.scale}
          expected
          empty={
            position.hasPlannedPages
              ? "Sem páginas previstas até hoje"
              : "Roteiro sem páginas definidas"
          }
        />
        <PositionBar
          label="Último registro"
          value={position.actual}
          max={position.scale}
          empty="Sem páginas registradas"
        />
      </div>
      <div className={styles.progressSource}>
        <p>
          {position.lastDate
            ? `Registrado em ${dateLabel(position.lastDate)}`
            : "Aguardando o registro do professor"}
        </p>
        <Button variant="link" size="inline" onClick={onRecords}>
          Consultar aulas · {data.records.length}
        </Button>
      </div>
    </section>
  );
}

function PositionBar({
  label,
  value,
  max,
  expected,
  empty,
}: {
  label: string;
  value: number | null;
  max: number;
  expected?: boolean;
  empty: string;
}) {
  return (
    <div className={styles.position}>
      <div>
        <span>{label}</span>
        <strong>{value === null ? "—" : `Pág. ${value}`}</strong>
      </div>
      <meter
        className={styles.meter}
        data-expected={expected || undefined}
        min={0}
        max={max}
        value={value ?? 0}
        aria-label={label}
        aria-valuetext={value === null ? empty : `Página ${value}`}
      />
      {value === null && <small>{empty}</small>}
    </div>
  );
}
