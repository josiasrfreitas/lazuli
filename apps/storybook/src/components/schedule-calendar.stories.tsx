import type { Meta, StoryObj } from "@storybook/nextjs";
import { useEffect, useState, type ReactElement } from "react";
import { CalendarPlus, UsersRound } from "lucide-react";
import {
  Button,
  ScheduleCalendar,
  type CalendarEvent,
  type CalendarInterval,
  type CalendarView,
  type ScheduleCalendarProps,
} from "@lazuli/ui";

const MONDAY = "2026-10-19";
const TUESDAY = "2026-10-20";

const events: CalendarEvent[] = [
  {
    id: "group-a",
    date: MONDAY,
    startTime: "09:00",
    endTime: "10:30",
    title: "Turma A",
    subtitle: "Professora Marina",
    description: "Regular · Presencial",
    tone: "info",
  },
  {
    id: "group-b",
    date: MONDAY,
    startTime: "09:30",
    endTime: "11:00",
    title: "Turma B",
    subtitle: "Professor Rafael",
    description: "PPT · Online",
    tone: "accent",
  },
  {
    id: "appointment",
    date: TUESDAY,
    startTime: "14:00",
    endTime: "15:00",
    title: "Atendimento",
    subtitle: "Reforço",
    tone: "success",
  },
  {
    id: "intro",
    date: "2026-10-21",
    startTime: "10:00",
    endTime: "11:00",
    title: "Experimental",
    subtitle: "Professora Marina",
    tone: "warning",
  },
  {
    id: "meeting",
    date: "2026-10-23",
    startTime: "15:30",
    endTime: "16:30",
    title: "Reunião pedagógica",
    disabled: true,
    disabledReason: "Compromisso indisponível para seleção",
  },
];

const meta = {
  title: "Components/ScheduleCalendar",
  component: ScheduleCalendar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Calendário controlado com visões diária e semanal. Recebe eventos genéricos, datas civis (YYYY-MM-DD) e horários (HH:mm). A tela fornece dados, filtros, regras de disponibilidade e ações; o componente organiza sobreposições, navegação, seleção e estados. A seleção de um intervalo é uma intenção: salvar e validar conflitos no servidor continuam sendo responsabilidade da tela. Consulte docs/frontend/schedule-calendar.md para o contrato completo.",
      },
    },
  },
  args: {
    date: MONDAY,
    view: "week",
    events,
    density: "compact",
    status: "ready",
    timeZone: "America/Sao_Paulo",
    onDateChange: () => {},
    onViewChange: () => {},
  },
  argTypes: {
    date: { control: "text" },
    dayCount: { control: { type: "number", min: 1, step: 1 } },
    minDate: { control: "text" },
    maxDate: { control: "text" },
    view: { control: "radio", options: ["day", "week"] },
    density: { control: "radio", options: ["comfortable", "compact"] },
    widthBehavior: { control: "radio", options: ["scroll", "fit"] },
    expandedEventWidth: { control: { type: "number", min: 160, max: 640, step: 20 } },
    status: { control: "radio", options: ["ready", "loading", "error"] },
    events: { control: false },
    rangeSelection: { control: false },
    renderEvent: { control: false },
    onDateChange: { control: false },
    onViewChange: { control: false },
  },
} satisfies Meta<typeof ScheduleCalendar>;
export default meta;
type Story = StoryObj<typeof meta>;

function Example(props: ScheduleCalendarProps): ReactElement {
  const [date, setDate] = useState(props.date);
  const [view, setView] = useState<CalendarView>(props.view);
  useEffect(() => setDate(props.date), [props.date]);
  useEffect(() => setView(props.view), [props.view]);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="flex h-[38rem] w-full min-w-0 flex-col gap-2">
      <ScheduleCalendar
        {...props}
        date={date}
        view={view}
        onDateChange={setDate}
        onViewChange={setView}
        selectedEventId={selected}
        onEventActivate={(event) => setSelected(event.id)}
      />
      {selected && (
        <p className="text-caption text-muted-foreground" role="status">
          Evento selecionado: {props.events.find((event) => event.id === selected)?.title}
        </p>
      )}
    </div>
  );
}
export const Weekly: Story = {
  render: (args) => <Example key={`${args.view}:${args.date}`} {...args} />,
};
export const TuesdayToMonday: Story = {
  args: {
    date: TUESDAY,
    dayCount: 7,
    events: [...events, { ...events[0]!, id: "following-monday", date: "2026-10-26" }],
  },
  render: (args) => <Example {...args} />,
};
export const WednesdayToTuesday: Story = {
  args: { date: "2026-10-21", dayCount: 7 },
  render: (args) => <Example {...args} />,
};
export const ThreeDays: Story = {
  args: { date: TUESDAY, dayCount: 3 },
  render: (args) => <Example {...args} />,
};
export const TenDays: Story = {
  args: { date: TUESDAY, dayCount: 10 },
  render: (args) => <Example {...args} />,
};
export const BoundedPeriod: Story = {
  args: { date: TUESDAY, dayCount: 7, minDate: TUESDAY, maxDate: "2026-10-29" },
  render: (args) => <Example {...args} />,
};
export const SingleAllowedDate: Story = {
  args: { date: TUESDAY, dayCount: 1, minDate: TUESDAY, maxDate: TUESDAY },
  render: (args) => <Example {...args} />,
};
export const Daily: Story = {
  args: { view: "day" },
  render: (args) => <Example key={args.view} {...args} />,
};
/** All days and concurrent events remain within the available phone width. */
export const Fitted: Story = {
  args: { view: "day", widthBehavior: "fit", expandEvents: false },
  render: (args) => (
    <div className="w-80 max-w-full">
      <Example {...args} />
    </div>
  ),
};
/** Resize the canvas: short events use horizontal space before hiding supporting text. */
export const ShortAppointments: Story = {
  args: {
    view: "day",
    events: [
      { ...events[0]!, id: "short-review", endTime: "09:30", title: "Revisão de aprendizagem" },
      {
        ...events[1]!,
        id: "short-planning",
        startTime: events[0]!.startTime,
        endTime: "10:00",
        title: "Planejamento da turma",
      },
    ],
  },
  render: (args) => <Example {...args} />,
};
/** Fully readable cards keep their width on hover and keyboard focus. */
export const ContentFits: Story = {
  args: {
    dayCount: 3,
    events: [
      {
        id: "readable-event",
        date: MONDAY,
        startTime: "09:00",
        endTime: "11:00",
        title: "Turma A",
        subtitle: "Marina",
        description: "Regular · Presencial",
        tone: "info",
      },
    ],
  },
  render: (args) => <Example {...args} />,
};
/** A solitary event can still need expansion when its text is truncated. */
export const ContentNeedsRoom: Story = {
  args: {
    events: [
      {
        id: "long-event",
        date: MONDAY,
        startTime: "09:00",
        endTime: "11:00",
        title: "Revisão das atividades de conversação",
        subtitle: "Professora Marina Albuquerque",
        description: "Preparação para a avaliação oral da turma",
        tone: "info",
      },
    ],
  },
  render: (args) => <Example {...args} />,
};
export const Comfortable: Story = {
  args: { density: "comfortable" },
  render: (args) => <Example {...args} />,
};
export const Empty: Story = { args: { events: [] }, render: (args) => <Example {...args} /> };
export const Loading: Story = {
  args: { status: "loading" },
  render: (args) => <Example {...args} />,
};
export const Error: Story = {
  args: { status: "error", onRetry: () => {} },
  render: (args) => <Example {...args} />,
};
export const ManyOverlaps: Story = {
  args: {
    events: Array.from({ length: 7 }, (_unused, index) => ({
      id: `overlap-${index}`,
      date: MONDAY,
      startTime: "09:00",
      endTime: index % 2 === 0 ? "11:00" : "10:00",
      title: `Compromisso ${index + 1}`,
      subtitle: "Abra +Mais para ver todos",
      tone: "info" as const,
    })),
  },
  render: (args) => <Example {...args} />,
};

function SelectionExample(props: ScheduleCalendarProps): ReactElement {
  const [date, setDate] = useState(props.date);
  const [view, setView] = useState(props.view);
  useEffect(() => setDate(props.date), [props.date]);
  useEffect(() => setView(props.view), [props.view]);
  const [selection, setSelection] = useState<CalendarInterval | null>(null);
  return (
    <div className="h-[38rem] w-full min-w-0">
      <ScheduleCalendar
        {...props}
        date={date}
        view={view}
        onDateChange={setDate}
        onViewChange={setView}
        rangeSelection={{
          value: selection,
          onSelect: setSelection,
          minimum: { date: MONDAY, time: "08:00" },
          blocked: [
            ...events.map((event) => ({ ...event, label: event.title })),
            {
              id: "hidden",
              date: "2026-10-22",
              startTime: "13:00",
              endTime: "15:00",
              label: "Compromisso oculto pelo filtro",
            },
          ],
          getError: (range) =>
            range.date === "2026-10-25" ? "Escola fechada neste domingo." : undefined,
        }}
      />
    </div>
  );
}
export const SelectTime: Story = { render: (args) => <SelectionExample {...args} /> };
export const DailySelection: Story = {
  args: { view: "day" },
  render: (args) => <SelectionExample {...args} />,
};
export const Narrow: Story = {
  render: (args) => (
    <div className="w-80 max-w-full">
      <SelectionExample {...args} />
    </div>
  ),
};
export const CustomContentAndActions: Story = {
  render: (args) => (
    <Example
      {...args}
      filters={<span className="text-caption text-muted-foreground">Professor: Marina</span>}
      actions={
        <Button type="button" size="sm">
          <CalendarPlus />
          Novo encontro
        </Button>
      }
      renderEvent={(event, { activate, selected, disabled }) => (
        <button
          type="button"
          onClick={activate}
          disabled={disabled}
          aria-pressed={selected}
          className="lz-calendar-event"
          data-tone={event.tone}
          aria-label={`${event.title}, ${event.startTime}–${event.endTime}`}
        >
          <strong>{event.title}</strong>
          <span>
            {event.startTime}–{event.endTime}
          </span>
          <span className="inline-flex items-center gap-1">
            <UsersRound className="size-3" aria-hidden />
            Conteúdo da tela consumidora
          </span>
        </button>
      )}
    />
  ),
};
