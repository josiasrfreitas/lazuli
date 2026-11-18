"use client";
import { useMemo, useState, type ReactElement } from "react";
import {
  Check,
  TriangleAlert,
  CalendarDays,
  ClipboardList,
  Search,
  UsersRound,
} from "lucide-react";
import { Button, Input, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { formationTeachingDay } from "@lazuli/domain";
import { dateOnly } from "./shared";
import {
  compatible,
  type OrganizationAction,
  type OrganizationBoard,
  type Placement,
  type ClassPlan,
} from "./model";
import { FormationPanel } from "./formation-panel";
import { useFormationNavigation, type FormationNavigation } from "./use-formation-navigation";
import {
  atRisk,
  matchesPlan,
  teachingWeek,
  weeklyPlaces,
  type TeachingDay,
} from "./formation-calendar";
import { planMetrics } from "./confirmation";
import { WeekHeader, weekdayLabel } from "./week-header";
import styles from "./formation.module.css";

const WEEKDAY_ABBREVIATION_LENGTH = 3;

type Props = {
  board: OrganizationBoard;
  selected: string | null;
  today: string;
  onSelect: (id: string | null) => void;
  onAction: (action: OrganizationAction) => void;
  onFeedback: (message: string) => void;
  prepare: () => void;
  preparing: boolean;
  scope: string;
  query: string;
  clearFilters: () => void;
};

type AgendaNavigation = FormationNavigation & {
  ended: boolean;
  plan: ClassPlan | undefined;
  student: Placement | null | undefined;
  plans: ClassPlan[];
};
function useAgendaNavigation({
  board,
  onSelect,
  selected,
  today,
  query,
  scope,
}: Props): AgendaNavigation {
  const navigation = useFormationNavigation(selected, onSelect);
  const { panel } = navigation;
  const ended = dateOnly(board.semester.endDate) < today;
  const plan = board.plans.find((choice) => choice.id === selected);
  const student =
    panel?.kind === "student" ? board.placements.find((row) => row.id === panel.id) : null;

  const plans = board.plans.filter(
    (choice) =>
      (scope === "closed" ? !choice.active : choice.active) &&
      matchesPlan(choice, query) &&
      (scope !== "risk" || atRisk(board, choice)) &&
      (scope !== "ppt" || choice.scheduleType === "PERSONALIZED") &&
      (!student || compatible(student, choice)),
  );
  return { ...navigation, ended, plan, student, plans };
}
export function OrganizationAgenda(props: Props): ReactElement {
  const { board, selected, onAction, onFeedback, prepare, preparing, clearFilters } = props;
  const {
    panel,
    grouped,
    expandQueue,
    mobile,
    setMobile,
    workspace,
    ended,
    plan,
    student,
    plans,
    showPlan,
    selectPerson,
    goBack,
    reset,
  } = useAgendaNavigation(props);
  return (
    <div
      className={styles.workspace}
      data-mobile={mobile}
      data-formation-expanded={grouped || plan || panel ? "" : undefined}
      data-formation-workspace=""
      ref={workspace}
    >
      <WorkspacePicker mobile={mobile} setMobile={setMobile} />
      <section className={styles.schedule} aria-label="Grade semanal de turmas">
        <a className={styles.skipPanel} href="#formation-panel-heading">
          Ir para o painel de formação
        </a>
        {student && (
          <div className={styles.match}>
            Encaixes para <strong>{student.studentName}</strong>
            <Button size="sm" variant="ghost" onClick={reset}>
              Limpar
            </Button>
          </div>
        )}
        {plans.length > 0 ? (
          <WeekGrid
            board={board}
            plans={plans}
            days={teachingWeek}
            selected={selected}
            onSelect={showPlan}
          />
        ) : (
          <EmptySchedule
            board={board}
            ended={ended}
            prepare={prepare}
            preparing={preparing}
            onAction={onAction}
            clearFilters={() => {
              clearFilters();
              reset();
            }}
          />
        )}
      </section>
      <FormationPanel
        board={board}
        plan={plan}
        selection={panel}
        grouped={grouped}
        expandQueue={expandQueue}
        ended={ended}
        onAction={onAction}
        onFeedback={onFeedback}
        onSelectPlan={showPlan}
        onSelect={selectPerson}
        onBack={goBack}
      />
    </div>
  );
}

function WorkspacePicker({
  mobile,
  setMobile,
}: Pick<FormationNavigation, "mobile" | "setMobile">): ReactElement {
  return (
    <div className={styles.mobileTools}>
      <SegmentedControl
        size="sm"
        aria-label="Área de trabalho"
        value={mobile}
        onValueChange={(value) => {
          if (value) setMobile(value);
        }}
      >
        <SegmentedControlItem value="grade">
          <CalendarDays size={14} /> Grade
        </SegmentedControlItem>
        <SegmentedControlItem value="painel">
          <ClipboardList size={14} /> Pendências
        </SegmentedControlItem>
      </SegmentedControl>
    </div>
  );
}
function EmptySchedule({
  board,
  ended,
  prepare,
  preparing,
  onAction,
  clearFilters,
}: Pick<Props, "board" | "prepare" | "preparing" | "onAction" | "clearFilters"> & {
  ended: boolean;
}): ReactElement {
  if (board.plans.length > 0)
    return (
      <div className={styles.zero}>
        <h2>Nenhuma turma neste recorte</h2>
        <Button size="sm" variant="ghost" onClick={clearFilters}>
          Mostrar todas as turmas
        </Button>
      </div>
    );
  return (
    <div className={styles.zero}>
      <UsersRound size={26} />
      <h2>Preparar as turmas de {board.semester.name}</h2>
      <p>Traga os horários, professores e alunos do período de origem.</p>
      {!ended && (
        <>
          <Button size="sm" disabled={preparing} onClick={prepare}>
            {preparing ? "Preparando…" : "Preparar turmas"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onAction({ kind: "plan" })}>
            Criar uma turma
          </Button>
        </>
      )}
    </div>
  );
}
export function WeekControls({
  board,
  scope,
  query,
  onScope,
  onQuery,
}: {
  board: OrganizationBoard;
  scope: string;
  query: string;
  onScope: (value: string) => void;
  onQuery: (value: string) => void;
}): ReactElement {
  const riskCount = board.plans.filter((choice) => atRisk(board, choice)).length;
  return (
    <div className={styles.weekControls}>
      <SegmentedControl
        size="sm"
        wrap
        value={scope}
        aria-label="Turmas na grade"
        onValueChange={(value) => {
          if (value) onScope(value);
        }}
      >
        <SegmentedControlItem value="all">Todas</SegmentedControlItem>
        <SegmentedControlItem value="ppt">PPT</SegmentedControlItem>
        <SegmentedControlItem value="risk">Em risco · {riskCount}</SegmentedControlItem>
        {board.plans.some((choice) => !choice.active) && (
          <SegmentedControlItem value="closed">Desfeitas</SegmentedControlItem>
        )}
      </SegmentedControl>
      <Input
        size="sm"
        leadingIcon={<Search />}
        aria-label="Buscar turma ou professor"
        placeholder="Turma ou professor"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
      />
    </div>
  );
}

function WeekGrid({
  board,
  plans,
  days,
  selected,
  onSelect,
}: {
  board: OrganizationBoard;
  plans: ClassPlan[];
  days: readonly TeachingDay[];
  selected: string | null;
  onSelect: (choice: ClassPlan, origin: HTMLElement) => void;
}): ReactElement {
  const [day, setDay] = useState<TeachingDay>(days[0] ?? "MONDAY");
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const hours = useMemo(() => weeklyPlaces(plans), [plans]);
  const unscheduled = plans.filter(
    (plan) => plan.slots.length === 0 || plan.slots.some((slot) => !formationTeachingDay(slot)),
  );
  const metrics = useMemo(
    () => new Map(plans.map((plan) => [plan.id, planMetrics(board, plan)])),
    [plans, board],
  );
  return (
    <>
      <div className={styles.gridLegend} aria-label="Legenda da grade">
        <span>
          <UsersRound size={13} /> Total confirmado ou pré-confirmado
        </span>
        <span>
          <Check size={13} /> Pré-confirmados
        </span>
        <span>
          <TriangleAlert size={13} /> Turma em risco
        </span>
      </div>
      <DayPicker day={day} days={days} setDay={setDay} />
      <div className={styles.weekScroll} data-formation-week="">
        <table className={styles.week}>
          <caption className="sr-only">Horários habituais das turmas por dia da semana</caption>
          <WeekHeader day={day} days={days} />
          <tbody>
            {hours.map(([start, byDay]) => (
              <tr key={start} data-day-empty={!byDay.has(day)}>
                <th scope="row">{start}</th>
                {days.map((weekday) => (
                  <td
                    key={weekday}
                    data-day-selected={weekday === day}
                    data-closed={weekday === "SATURDAY" && start >= "12:00"}
                  >
                    {byDay.get(weekday)?.map(({ plan, endTime }) => (
                      <TeachingSlot
                        key={plan.id + endTime}
                        plan={plan}
                        clock={{ start, endTime, day: weekday }}
                        count={metrics.get(plan.id)!.confirmed}
                        preconfirmed={metrics.get(plan.id)!.preconfirmed}
                        highlighted={plan.id === (hovered ?? focused)}
                        onHover={setHovered}
                        onFocusPlan={setFocused}
                        limit={board.semester.formationRiskLimit}
                        selected={selected === plan.id}
                        onSelect={onSelect}
                      />
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!hours.some(([, byDay]) => byDay.has(day)) && (
          <p className={styles.emptyDay}>Nenhuma aula neste dia para as turmas exibidas.</p>
        )}
        <UnscheduledPlans plans={unscheduled} onSelect={onSelect} />
      </div>
    </>
  );
}

function DayPicker({
  day,
  days,
  setDay,
}: {
  day: TeachingDay;
  days: readonly TeachingDay[];
  setDay: (day: TeachingDay) => void;
}): ReactElement {
  return (
    <div className={styles.dayPicker} aria-label="Dia da semana">
      {days.map((weekday) => (
        <button
          type="button"
          key={weekday}
          aria-pressed={day === weekday}
          onClick={() => setDay(weekday)}
        >
          {weekdayLabel(weekday).slice(0, WEEKDAY_ABBREVIATION_LENGTH)}
        </button>
      ))}
    </div>
  );
}
function UnscheduledPlans({
  plans,
  onSelect,
}: {
  plans: ClassPlan[];
  onSelect: (plan: ClassPlan, origin: HTMLElement) => void;
}): ReactElement | null {
  if (plans.length === 0) return null;
  return (
    <section className={styles.unscheduled}>
      <h3>Horários a definir ou revisar</h3>
      {plans.map((plan) => (
        <Button
          key={plan.id}
          size="sm"
          variant="secondary"
          data-formation-focus={`unscheduled-${plan.id}`}
          aria-controls="formation-panel"
          onClick={(event) => onSelect(plan, event.currentTarget)}
        >
          {plan.scheduleType === "PERSONALIZED" ? "PPT" : (plan.stageCode ?? "Estágio a definir")} ·{" "}
          {plan.name}
        </Button>
      ))}
    </section>
  );
}
function TeachingSlot({
  plan,
  clock,
  count,
  preconfirmed,
  highlighted,
  onHover,
  onFocusPlan,
  limit,
  selected,
  onSelect,
}: {
  plan: ClassPlan;
  clock: { start: string; endTime: string; day: TeachingDay };
  count: number;
  preconfirmed: number;
  highlighted: boolean;
  onHover: (id: string | null) => void;
  onFocusPlan: (id: string | null) => void;
  limit: number;
  selected: boolean;
  onSelect: (plan: ClassPlan, origin: HTMLElement) => void;
}): ReactElement {
  const { start, endTime, day } = clock;
  const risk = plan.active && count <= limit;
  const title =
    plan.scheduleType === "PERSONALIZED"
      ? "PPT"
      : (plan.stageCode ?? "Regular · estágio a definir");
  const professor = plan.teacherName ?? "Professor a definir";
  const interval = `${start}–${endTime}`;
  return (
    <button
      type="button"
      className={styles.place}
      data-highlighted={highlighted}
      onMouseEnter={() => onHover(plan.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onFocusPlan(plan.id)}
      onBlur={() => onFocusPlan(null)}
      data-ppt={plan.scheduleType === "PERSONALIZED"}
      aria-pressed={selected}
      aria-label={`${title} · ${plan.name} · ${professor} · ${weekdayLabel(day)} ${interval} · ${count - preconfirmed} confirmados, ${preconfirmed} pré-confirmados${risk ? ", turma em risco" : ""}`}
      title={`${plan.name} · ${interval} · ${professor}`}
      aria-controls="formation-panel"
      data-formation-focus={`slot-${plan.id}-${day}-${start}`}
      onClick={(event) => onSelect(plan, event.currentTarget)}
    >
      <span className={styles.placeTitle}>
        <span className={styles.placeName}>{title}</span>
        <small>{endTime}</small>
      </span>
      <span className={styles.placeDetails}>
        <span>{professor}</span>
      </span>
      <span className={styles.slotCounts}>
        <span
          className={styles.placeCount}
          data-risk={risk}
          title={`${count - preconfirmed} confirmados · ${preconfirmed} pré-confirmados`}
        >
          {risk ? <TriangleAlert size={12} /> : <UsersRound size={12} />} {count}
        </span>
        {preconfirmed > 0 && (
          <span className={styles.preconfirmed} title={`${preconfirmed} pré-confirmados`}>
            <Check size={12} /> {preconfirmed}
          </span>
        )}
      </span>
    </button>
  );
}
