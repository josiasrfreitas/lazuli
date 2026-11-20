"use client";

import type { ReactElement } from "react";
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
import { calendarDay, type AcademicYear, type DayInfo } from "./model";
import {
  civilDate,
  entriesInRange,
  fullDate,
  isoDay,
  shortDate,
  type CalendarEntry,
} from "./date-model";
import styles from "./workspace.module.css";
import {
  calendarPeriodsInYear,
  calendarVacationRanges,
  vacationAt,
  type CalendarPeriod,
  type CalendarVacations,
} from "./period-model";

type ContextProps = {
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
};
type LoadedProps = ContextProps & { data: AcademicYear };
const DAY_SUFFIX = -2;
const HIGHLIGHT_LIMIT = 5;
export function CalendarContextPanel(props: ContextProps): ReactElement {
  if (props.unavailable) return <UnavailableContext />;
  if (!props.data) return <LoadingContext />;
  const loaded = { ...props, data: props.data };
  return props.date ? (
    <DayContextPanel {...loaded} date={props.date} />
  ) : (
    <PeriodContextPanel {...loaded} />
  );
}
function UnavailableContext(): ReactElement {
  return (
    <aside className={styles.context}>
      <h2>Datas indisponíveis</h2>
      <p className={styles.emptyNote}>
        Tente carregar novamente para consultar os períodos e eventos deste ano.
      </p>
    </aside>
  );
}
function LoadingContext(): ReactElement {
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
}
function DayContextPanel({
  date,
  data,
  entries,
  period,
  vacations,
  onClear,
  onEdit,
  daily = false,
  onCreate,
  onDayAgenda,
  onInterruption,
  onSelectDate,
}: LoadedProps & { date: string }): ReactElement {
  const info = calendarDay(date, data);
  const items = entriesInRange(entries, { from: date, through: date });
  const outside = Boolean(
    period && (date < civilDate(period.startDate) || date > civilDate(period.endDate)),
  );
  const vacation = vacationAt(date, vacations);
  return (
    <aside className={styles.context} aria-label="Detalhes do dia">
      <DayHeading date={date} onClear={onClear} />
      {period && outside && !vacation && (
        <p className={styles.emptyNote}>
          Esta data está fora do período {period.name}. Os eventos continuam disponíveis para
          consulta.
        </p>
      )}
      <DayStatus info={info} vacation={vacation} outside={outside} period={period} />
      <DayActions
        items={items}
        onEdit={onEdit}
        daily={daily}
        onCreate={onCreate}
        onDayAgenda={onDayAgenda}
        onInterruption={onInterruption}
      />
      {period && <VacationContext compact vacations={vacations} onSelectDate={onSelectDate} />}
    </aside>
  );
}
function PeriodContextPanel({
  data,
  period,
  entries,
  today,
  month,
  year,
  onEdit,
  onConfigure,
  vacations,
  onSelectDate,
}: LoadedProps): ReactElement {
  const periods = period ? [period] : calendarPeriodsInYear(data.periods, year);
  const scoped = entries;
  const upcoming = scoped.filter((row) => row.through >= today);
  const highlights =
    month === null ? (upcoming.length > 0 ? upcoming : scoped).slice(0, HIGHLIGHT_LIMIT) : scoped;
  const scopeStart =
    month === null && period
      ? civilDate(period.startDate)
      : isoDay({ year, month: month ?? 0, day: 1 });
  return (
    <aside className={styles.context} aria-label="Contexto acadêmico">
      <div className={styles.contextHeading}>
        <h2>
          <CalendarRange aria-hidden="true" />{" "}
          {period ? "Período selecionado" : `Períodos de ${year}`}
        </h2>
      </div>
      <SelectedPeriods periods={periods} onEdit={onEdit} onConfigure={onConfigure} />
      {period && <VacationContext vacations={vacations} onSelectDate={onSelectDate} />}
      {!period && <YearVacationContext data={data} year={year} onSelectDate={onSelectDate} />}
      <Highlights
        month={month}
        upcoming={upcoming}
        highlights={highlights}
        scopeStart={scopeStart}
        onSelectDate={onSelectDate}
      />
      <CalendarLegend />
    </aside>
  );
}

function YearVacationContext({
  data,
  year,
  onSelectDate,
}: Pick<LoadedProps, "data" | "year" | "onSelectDate">): ReactElement | null {
  const ranges = calendarVacationRanges(data.periods, year);
  if (ranges.length === 0) return null;
  return (
    <div className={styles.vacations} aria-label="Férias do calendário">
      {ranges.map((range) => (
        <button
          type="button"
          key={range.from}
          onClick={() => onSelectDate(range.from < `${year}-01-01` ? `${year}-01-01` : range.from)}
        >
          <Palmtree aria-hidden="true" />
          <span>
            <strong>Férias acadêmicas</strong>
            <small>
              {shortDate(range.from, true)} — {shortDate(range.through, true)}
            </small>
          </span>
          <ArrowRight aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function Entry({
  entry,
  onActivate,
}: {
  entry: CalendarEntry;
  onActivate: () => void;
}): ReactElement {
  const Icon = entryIcon(entry);
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
}): ReactElement | null {
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

export function CalendarLegend(): ReactElement {
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

function DayHeading({
  date,
  onClear,
}: Pick<ContextProps, "onClear"> & { date: string }): ReactElement {
  return (
    <div className={styles.contextHeading}>
      <div className={styles.dateHeading}>
        <strong>{Number(date.slice(DAY_SUFFIX))}</strong>
        <h2>{fullDate(date)}</h2>
      </div>
      <Button size="icon-sm" variant="ghost" onClick={onClear} aria-label="Fechar detalhes do dia">
        <X />
      </Button>
    </div>
  );
}

function DayActions({
  items,
  onEdit,
  daily = false,
  onCreate,
  onDayAgenda,
  onInterruption,
}: Pick<ContextProps, "onEdit" | "daily" | "onCreate" | "onDayAgenda" | "onInterruption"> & {
  items: CalendarEntry[];
}): ReactElement {
  return (
    <>
      {" "}
      {items.length > 0 ? (
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
    </>
  );
}

function SelectedPeriods({
  periods,
  onEdit,
  onConfigure,
}: Pick<ContextProps, "onEdit" | "onConfigure"> & { periods: CalendarPeriod[] }): ReactElement {
  return periods.length > 0 ? (
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
  );
}

function Highlights({
  month,
  upcoming,
  highlights,
  scopeStart,
  onSelectDate,
}: Pick<ContextProps, "month" | "onSelectDate"> & {
  upcoming: CalendarEntry[];
  highlights: CalendarEntry[];
  scopeStart: string;
}): ReactElement {
  return (
    <section className={styles.contextSection}>
      <h2>{highlightsTitle(month, upcoming)}</h2>
      {highlights.length > 0 ? (
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
                <small>{highlightLabel(entry)}</small>
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
  );
}
function highlightsTitle(month: number | null, upcoming: CalendarEntry[]): string {
  if (month !== null) return "Datas do mês";
  return upcoming.length > 0 ? "Próximas datas" : "Datas do período";
}
function highlightLabel(entry: CalendarEntry): string {
  if (entry.kind === "holiday") return "Sem atividades acadêmicas";
  return entry.kind === "boundary" ? "Limite do semestre" : "Evento · aulas mantidas";
}
type DayStatusProps = {
  info: DayInfo;
  vacation: ReturnType<typeof vacationAt>;
  outside: boolean;
  period: CalendarPeriod | null;
};
function statusKind({ info, vacation, outside }: DayStatusProps): string {
  if (info.kind === "holiday") return "holiday";
  if (vacation) return "vacation";
  return outside ? "unknown" : info.kind;
}
function statusTitle({ info, vacation, outside }: DayStatusProps): string {
  if (info.kind === "holiday") return "Sem atividades acadêmicas";
  if (vacation) return vacation === "before" ? "Férias anteriores" : "Férias após o período";
  if (outside) return "Fora do período selecionado";
  if (info.kind === "vacation") return "Férias acadêmicas";
  return info.kind === "unknown" ? "Período não configurado" : "Dentro do período acadêmico";
}
function statusDetail({ info, vacation, outside, period }: DayStatusProps): string {
  if (info.kind === "holiday") return "A suspensão inclui aulas, atendimentos e experimentais.";
  if (vacation) return "Sem aulas regulares. Atendimentos fora do período exigem confirmação.";
  if (outside && period)
    return `${period.name} vai de ${shortDate(civilDate(period.startDate))} a ${shortDate(civilDate(period.endDate))}.`;
  return info.kind === "academic" || info.kind === "boundary"
    ? "As aulas seguem os horários de cada turma."
    : info.detail;
}
function DayStatus(props: DayStatusProps): ReactElement {
  return (
    <div className={styles.dayStatus} data-kind={statusKind(props)}>
      {props.vacation ? <Palmtree aria-hidden="true" /> : <CalendarDays aria-hidden="true" />}
      <div>
        <strong>{statusTitle(props)}</strong>
        <p>{statusDetail(props)}</p>
      </div>
    </div>
  );
}

function entryIcon(entry: CalendarEntry): typeof CalendarRange {
  if (entry.kind === "boundary") return CalendarRange;
  return entry.kind === "holiday" ? Flag : Clock3;
}
