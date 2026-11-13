"use client";

import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  Clock3,
  Flag,
  Palmtree,
  Plus,
  X,
} from "lucide-react";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { calendarDay, type AcademicYear } from "./model";
import {
  civilDate,
  entriesInRange,
  fullDate,
  isoDay,
  shortDate,
  type CalendarEntry,
} from "./date-model";
import styles from "./workspace.module.css";
import { vacationAt, type CalendarPeriod, type CalendarVacations } from "./period-model";

export function CalendarContextPanel({
  data,
  entries,
  year,
  month,
  date,
  today,
  onSelectDate,
  onEdit,
  onCreate,
  onInterruption,
  onDayAgenda,
  onClear,
  onConfigure,
  unavailable = false,
  daily = false,
  period,
  vacations,
}: {
  data?: AcademicYear | undefined;
  entries: CalendarEntry[];
  year: number;
  month: number | null;
  date: string | null;
  today: string;
  onSelectDate: (date: string) => void;
  onEdit: (entry: CalendarEntry) => void;
  onCreate: () => void;
  onInterruption: () => void;
  onDayAgenda: () => void;
  onClear: () => void;
  onConfigure: () => void;
  unavailable?: boolean;
  daily?: boolean;
  period: CalendarPeriod | null;
  vacations: CalendarVacations;
}) {
  if (unavailable)
    return (
      <aside className={styles.context}>
        <h2>Datas indisponíveis</h2>
        <p className={styles.emptyNote}>
          Tente carregar novamente para consultar os períodos e eventos deste ano.
        </p>
      </aside>
    );
  if (!data)
    return (
      <aside className={styles.context} aria-label="Carregando detalhes do calendário">
        <InlineSkeleton className="h-6 w-36" />
        {[0, 1, 2].map((key) => (
          <div key={key} className={styles.contextSection}>
            <InlineSkeleton className="w-full" />
            <InlineSkeleton className="w-32" />
          </div>
        ))}
      </aside>
    );
  if (date) {
    const info = calendarDay(date, data);
    const items = entriesInRange(entries, date, date);
    const outside = Boolean(
      period && (date < civilDate(period.startDate) || date > civilDate(period.endDate)),
    );
    const vacation = vacationAt(date, vacations);
    return (
      <aside className={styles.context} aria-label="Detalhes do dia">
        <div className={styles.contextHeading}>
          <div className={styles.dateHeading}>
            <strong>{Number(date.slice(-2))}</strong>
            <h2>{fullDate(date)}</h2>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onClear}
            aria-label="Fechar detalhes do dia"
          >
            <X />
          </Button>
        </div>
        {period && outside && !vacation && (
          <p className={styles.emptyNote}>
            Esta data está fora do período {period.name}. Os eventos continuam disponíveis para
            consulta.
          </p>
        )}
        <div
          className={styles.dayStatus}
          data-kind={
            info.kind === "holiday"
              ? "holiday"
              : vacation
                ? "vacation"
                : outside
                  ? "unknown"
                  : info.kind
          }
        >
          {vacation ? <Palmtree aria-hidden="true" /> : <CalendarDays aria-hidden="true" />}
          <div>
            <strong>
              {info.kind === "holiday"
                ? "Sem atividades acadêmicas"
                : vacation
                  ? vacation === "before"
                    ? "Férias anteriores"
                    : "Férias após o período"
                  : outside
                    ? "Fora do período selecionado"
                    : info.kind === "vacation"
                      ? "Férias acadêmicas"
                      : info.kind === "unknown"
                        ? "Período não configurado"
                        : "Dentro do período acadêmico"}
            </strong>
            <p>
              {info.kind === "holiday"
                ? "A suspensão inclui aulas, atendimentos e experimentais."
                : vacation
                  ? "Sem aulas regulares. Atendimentos fora do período exigem confirmação."
                  : outside && period
                    ? `${period.name} vai de ${shortDate(civilDate(period.startDate))} a ${shortDate(civilDate(period.endDate))}.`
                    : info.kind === "academic" || info.kind === "boundary"
                      ? "As aulas seguem os horários de cada turma."
                      : info.detail}
            </p>
          </div>
        </div>
        {items.length ? (
          <div className={styles.entryList}>
            {items.map((entry) => (
              <Entry key={entry.key} entry={entry} onActivate={() => onEdit(entry)} />
            ))}
          </div>
        ) : (
          <p className={styles.emptyNote}>
            Nenhum evento neste dia. Adicione uma data importante para a escola.
          </p>
        )}
        <div className={styles.contextActions}>
          <Button size="sm" variant="secondary" onClick={onCreate}>
            <Plus aria-hidden="true" /> Adicionar evento neste dia
          </Button>
          {!daily && (
            <Button size="sm" variant="ghost" onClick={onDayAgenda}>
              <Clock3 aria-hidden="true" /> Ver agenda do dia <ArrowRight aria-hidden="true" />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onInterruption}>
            <Flag aria-hidden="true" /> Registrar feriado ou recesso
          </Button>
        </div>
        {period && <VacationContext compact vacations={vacations} onSelectDate={onSelectDate} />}
      </aside>
    );
  }
  const periods = period ? [period] : [];
  const scoped = entries;
  const upcoming = scoped.filter((row) => row.through >= today);
  const highlights = month === null ? (upcoming.length ? upcoming : scoped).slice(0, 5) : scoped;
  const scopeStart =
    month === null && period ? civilDate(period.startDate) : isoDay(year, month ?? 0, 1);
  return (
    <aside className={styles.context} aria-label="Contexto acadêmico">
      <div className={styles.contextHeading}>
        <h2>
          <CalendarRange aria-hidden="true" /> Período selecionado
        </h2>
      </div>
      {periods.length ? (
        <div className={styles.periodList}>
          {periods.map((period) => (
            <button
              type="button"
              key={period.id}
              className={styles.period}
              onClick={() =>
                onEdit({
                  key: period.id,
                  id: period.id,
                  title: period.name,
                  kind: "boundary",
                  editor: "period",
                  from: civilDate(period.startDate),
                  through: civilDate(period.endDate),
                  detail: "Limite das aulas regulares",
                })
              }
            >
              <strong>{period.name}</strong>
              <span>
                {shortDate(civilDate(period.startDate))} <ArrowRight aria-hidden="true" />{" "}
                {shortDate(civilDate(period.endDate))}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.emptyNote}>
          <p>Nenhum período acadêmico foi cadastrado.</p>
          <Button size="sm" variant="secondary" onClick={onConfigure}>
            Definir semestres
          </Button>
        </div>
      )}
      {period && <VacationContext vacations={vacations} onSelectDate={onSelectDate} />}
      <section className={styles.contextSection}>
        <h2>
          {month === null
            ? upcoming.length
              ? "Próximas datas"
              : "Datas do período"
            : "Datas do mês"}
        </h2>
        {highlights.length ? (
          <div className={styles.entryList}>
            {highlights.map((entry) => (
              <button
                type="button"
                key={entry.key}
                className={styles.highlight}
                onClick={() => onSelectDate(entry.from < scopeStart ? scopeStart : entry.from)}
              >
                <span className={styles.highlightDate}>{shortDate(entry.from)}</span>
                <span>
                  <strong>{entry.title}</strong>
                  <small>
                    {entry.kind === "holiday"
                      ? "Sem atividades acadêmicas"
                      : entry.kind === "boundary"
                        ? "Limite do semestre"
                        : "Evento · aulas mantidas"}
                  </small>
                </span>
                <ArrowRight aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.emptyNote}>
            Nenhuma data cadastrada. Selecione um dia no calendário para começar.
          </p>
        )}
      </section>
      <CalendarLegend />
    </aside>
  );
}

function Entry({ entry, onActivate }: { entry: CalendarEntry; onActivate: () => void }) {
  const Icon = entry.kind === "boundary" ? CalendarRange : entry.kind === "holiday" ? Flag : Clock3;
  const content = (
    <>
      <Icon aria-hidden="true" />
      <span>
        <strong>{entry.title}</strong>
        <small>{entry.detail}</small>
        {entry.from !== entry.through && (
          <small>
            {shortDate(entry.from)} — {shortDate(entry.through)}
          </small>
        )}
        {entry.description && <p>{entry.description}</p>}
      </span>
      {entry.editor && <ArrowRight aria-hidden="true" />}
    </>
  );
  return entry.editor ? (
    <button
      type="button"
      className={styles.entry}
      data-kind={entry.kind}
      onClick={onActivate}
      aria-label={`Editar ${entry.title}`}
    >
      {content}
    </button>
  ) : (
    <div className={styles.entry} data-kind={entry.kind}>
      {content}
    </div>
  );
}

function VacationContext({
  vacations,
  onSelectDate,
  compact = false,
}: {
  vacations: CalendarVacations;
  onSelectDate: (date: string) => void;
  compact?: boolean;
}) {
  if (!vacations.before && !vacations.after) return null;
  return (
    <div className={styles.vacations} data-compact={compact} aria-label="Férias do período">
      {vacations.before && (
        <button
          type="button"
          data-before="true"
          onClick={() => onSelectDate(vacations.before!.through)}
        >
          <Palmtree aria-hidden="true" />
          <span>
            <strong>Férias anteriores</strong>
            <small>
              {vacations.before.from ? `${shortDate(vacations.before.from, true)} — ` : "Até "}
              {shortDate(vacations.before.through, true)}
            </small>
            {!vacations.before.from && <small>Período anterior ainda não definido</small>}
          </span>
          <ArrowRight aria-hidden="true" />
        </button>
      )}
      {vacations.after && (
        <button type="button" onClick={() => onSelectDate(vacations.after!.from)}>
          <Palmtree aria-hidden="true" />
          <span>
            <strong>Férias após o período</strong>
            <small>
              {vacations.after.through
                ? `${shortDate(vacations.after.from, true)} — ${shortDate(vacations.after.through, true)}`
                : `A partir de ${shortDate(vacations.after.from, true)}`}
            </small>
            {!vacations.after.through && <small>Próximo período ainda não definido</small>}
          </span>
          <ArrowRight aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function CalendarLegend() {
  return (
    <details className={styles.legend}>
      <summary>Como ler o calendário</summary>
      <div>
        <span>
          <i data-kind="boundary" /> Início e fim do semestre
        </span>
        <span>
          <i data-kind="holiday" /> Feriado ou recesso
        </span>
        <span>
          <i data-kind="event" /> Evento · aulas mantidas
        </span>
        <span>
          <i data-kind="vacation" /> Férias após o período
        </span>
        <span>
          <i data-kind="vacation-before" /> Férias anteriores · esmaecidas
        </span>
        <span>
          <i data-kind="unknown" /> Sem período configurado
        </span>
        <span>
          <i data-kind="outside" /> Esmaecido: fora do período selecionado
        </span>
      </div>
    </details>
  );
}
