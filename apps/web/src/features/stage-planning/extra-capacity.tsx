import type { ReactElement } from "react";
import { CalendarDays, Check, Clock3 } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { Badge } from "@lazuli/ui";
import type { Planning } from "./shared";
import { dateLabel } from "./shared";
import { semesterOutlook } from "./outlook-model";
import styles from "./adjustments.module.css";

export type ExtraPreview = RouterOutputs["planning"]["previewExtra"];
export const encounterLabel = (count: number): string =>
  `${count} ${count === 1 ? "encontro" : "encontros"}`;
export const hourLabel = (minutes: number): string =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(minutes / 60)}h`;
export function CompactExtraCapacity({
  preview,
  loading,
  error,
}: {
  preview: ExtraPreview | null;
  loading: boolean;
  error: string | null;
}): ReactElement {
  const message = loading
    ? "Conferindo horários…"
    : error
      ? "Revise os horários selecionados"
      : !preview
        ? "Selecione os dias para calcular as horas"
        : preview.uncertain
          ? "Saldo de conteúdo a confirmar"
          : preview.margin < 0
            ? `Ainda faltam ${hourLabel(-preview.margin)}`
            : preview.margin === 0
              ? "Conteúdo acomodado, sem folga"
              : `${hourLabel(preview.margin)} de folga para concluir`;
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
  const outlook = semesterOutlook(data);
  const remaining = preview?.remainingMinutes ?? outlook.remainingMinutes;
  const available = preview?.availableMinutes ?? outlook.availableMinutes;
  const added = preview?.addedMinutes ?? 0;
  const deficit = Math.max(0, remaining - available);
  const balance = available + added - remaining;
  const known = !(preview?.uncertain ?? outlook.status === "unknown");
  const max = Math.max(remaining, available + added, 1);
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
      <div className={styles.selectionResult} aria-live="polite" aria-atomic="true">
        {loading ? (
          <p>Calculando encontros e conferindo agendas…</p>
        ) : error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : preview ? (
          <>
            <div className={styles.capacityHeading}>
              <strong>+{hourLabel(added)} nesta seleção</strong>
              <Badge variant={balance >= 0 && known ? "success" : "info"}>
                {encounterLabel(preview.dates.length)}
              </Badge>
            </div>
            <p>
              {dateLabel(preview.dates[0]!)} a {dateLabel(preview.dates.at(-1)!)}
            </p>
            {known && (
              <div className={styles.capacityTrack} data-covered={balance >= 0 || undefined}>
                <progress
                  max={max}
                  value={available + added}
                  aria-label="Horas disponíveis com as aulas selecionadas"
                />
                <strong>
                  {balance < 0
                    ? `Ainda faltam ${hourLabel(-balance)}`
                    : balance === 0
                      ? "Conteúdo acomodado, sem folga"
                      : `${hourLabel(balance)} de folga para concluir`}
                </strong>
              </div>
            )}
            {!known && (
              <p>
                As horas entram no calendário. Confirme os registros pendentes para calcular o saldo
                do conteúdo.
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
        ) : (
          <>
            <p>
              {ready
                ? "Confira as datas e horários para calcular os encontros."
                : "Escolha professor, dias e intervalo para ver quanto essa seleção cobre."}
            </p>
            <p>
              Para usar horários diferentes em cada dia, salve um dia por vez. As aulas se somam às
              que você já agendou.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
