import type { ReactElement } from "react";
import { CalendarDays, Check, Clock3 } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { Badge } from "@lazuli/ui";
import type { Planning } from "./shared";
import { dateLabel } from "./shared";
import { semesterOutlook } from "./outlook-model";
import styles from "./adjustments.module.css";

export const MINUTES_PER_HOUR = 60;
export type ExtraPreview = RouterOutputs["planning"]["previewExtra"];
export const encounterLabel = (count: number): string =>
  `${count} ${count === 1 ? "encontro" : "encontros"}`;
export const hourLabel = (minutes: number): string =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(minutes / MINUTES_PER_HOUR)}h`;
export function CompactExtraCapacity({
  preview,
  loading,
  error,
}: {
  preview: ExtraPreview | null;
  loading: boolean;
  error: string | null;
}): ReactElement {
  const message = compactMessage({ preview, loading, error });
  return (
    <div
      className={styles.compactCapacity}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-covered={Boolean(preview && !preview.uncertain && preview.margin >= 0) || undefined}
    >
      {preview && !loading && (
        <strong>
          +{hourLabel(preview.addedMinutes)} · {encounterLabel(preview.dates.length)}
        </strong>
      )}
      <span>{message}</span>
    </div>
  );
}
function compactMessage({
  preview,
  loading,
  error,
}: {
  preview: ExtraPreview | null;
  loading: boolean;
  error: string | null;
}): string {
  if (loading) return "Conferindo horários…";
  if (error) return "Revise os horários selecionados";
  if (preview === null) return "Selecione os dias para calcular as horas";
  if (preview.uncertain) return "Saldo de conteúdo a confirmar";
  return capacityBalance(preview.margin);
}

function capacityBalance(balance: number): string {
  if (balance < 0) return `Ainda faltam ${hourLabel(-balance)}`;
  if (balance === 0) return "Conteúdo acomodado, sem folga";
  return `${hourLabel(balance)} de folga para concluir`;
}
export function ExtraCapacity({
  data,
  preview,
  loading,
  error,
  ready,
}: {
  data: Planning;
  preview: ExtraPreview | null;
  loading: boolean;
  error: string | null;
  ready: boolean;
}): ReactElement {
  const capacity = extraCapacitySummary(data, preview);
  const { remaining, available, deficit, known, max } = capacity;
  return (
    <aside
      className={styles.capacity}
      aria-label="Impacto da seleção nas horas da turma"
      aria-busy={loading}
    >
      <header>
        <Clock3 size={18} aria-hidden="true" />
        <h3>Como fica a turma</h3>
      </header>
      <div className={styles.capacityBaseline}>
        <div>
          <span>Conteúdo restante</span>
          <strong>{known ? hourLabel(remaining) : "A confirmar"}</strong>
        </div>
        <div>
          <span>Aulas já disponíveis</span>
          <strong>{hourLabel(available)}</strong>
        </div>
      </div>
      {known && (
        <div className={styles.capacityTrack}>
          <span>Antes da seleção</span>
          <progress max={max} value={available} aria-label="Horas de aula já disponíveis" />
          <p>
            {deficit > 0
              ? `Faltam ${hourLabel(deficit)} para acomodar o conteúdo.`
              : `Há ${hourLabel(available - remaining)} de folga.`}
          </p>
        </div>
      )}
      <CapacitySelection state={{ loading, error, ready, preview }} capacity={capacity} />
    </aside>
  );
}

type CapacitySummary = {
  available: number;
  added: number;
  balance: number;
  known: boolean;
  max: number;
};
function extraCapacitySummary(
  data: Planning,
  preview: ExtraPreview | null,
): CapacitySummary & { remaining: number; deficit: number } {
  const outlook = semesterOutlook(data);
  const remaining = preview?.remainingMinutes ?? outlook.remainingMinutes;
  const available = preview?.availableMinutes ?? outlook.availableMinutes;
  const added = preview?.addedMinutes ?? 0;
  const deficit = Math.max(0, remaining - available);
  const balance = available + added - remaining;
  const known = !(preview?.uncertain ?? outlook.status === "unknown");
  const max = Math.max(remaining, available + added, 1);
  return { remaining, available, added, deficit, balance, known, max };
}
type SelectionState = {
  loading: boolean;
  error: string | null;
  ready: boolean;
  preview: ExtraPreview | null;
};

function CapacitySelection({
  state,
  capacity,
}: {
  state: SelectionState;
  capacity: CapacitySummary;
}): ReactElement {
  return (
    <div className={styles.selectionResult} aria-live="polite" aria-atomic="true">
      <SelectionDetails state={state} capacity={capacity} />
    </div>
  );
}

function SelectionDetails({
  state,
  capacity,
}: {
  state: SelectionState;
  capacity: CapacitySummary;
}): ReactElement {
  const { loading, error, preview, ready } = state;
  if (loading) return <p>Calculando encontros e conferindo agendas…</p>;
  if (error)
    return (
      <p role="alert" className={styles.error}>
        {error}
      </p>
    );
  if (preview) return <CapacityProjection preview={preview} capacity={capacity} />;
  return (
    <>
      <p>
        {ready
          ? "Confira as datas e horários para calcular os encontros."
          : "Escolha professor, dias e intervalo para ver quanto essa seleção cobre."}
      </p>
      <p>
        Para usar horários diferentes em cada dia, salve um dia por vez. As aulas se somam às que
        você já agendou.
      </p>
    </>
  );
}

function CapacityProjection({
  preview,
  capacity,
}: {
  preview: ExtraPreview;
  capacity: CapacitySummary;
}): ReactElement {
  const { added, available, balance, known, max } = capacity;
  return (
    <>
      <div className={styles.capacityHeading}>
        <strong>+{hourLabel(added)} nesta seleção</strong>
        <Badge variant={balance >= 0 && known ? "success" : "info"}>
          {encounterLabel(preview.dates.length)}
        </Badge>
      </div>
      <p>
        {dateLabel(preview.dates[0])} a {dateLabel(preview.dates.at(-1))}
      </p>
      {known && (
        <div className={styles.capacityTrack} data-covered={balance >= 0 || undefined}>
          <progress
            max={max}
            value={available + added}
            aria-label="Horas disponíveis com as aulas selecionadas"
          />
          <strong>{capacityBalance(balance)}</strong>
        </div>
      )}
      {!known && (
        <p>
          As horas entram no calendário. Confirme os registros pendentes para calcular o saldo do
          conteúdo.
        </p>
      )}
      <p className={styles.selectionDetail}>
        <CalendarDays size={15} aria-hidden="true" />
        {hourLabel(available + added)} disponíveis com essa seleção.
      </p>
      {preview.outside > 0 && (
        <p>
          {encounterLabel(preview.outside)} nas férias ou fora do período letivo. Você vai confirmar
          essas datas no próximo passo.
        </p>
      )}
      {preview.skipped.length > 0 && (
        <p>
          {preview.skipped.length === 1
            ? "1 data de fechamento foi excluída."
            : `${preview.skipped.length} datas de fechamento foram excluídas.`}
        </p>
      )}
      <span className={styles.selectionDetail}>
        <Check size={15} aria-hidden="true" />
        Horários conferidos para professor e alunos.
      </span>
    </>
  );
}
