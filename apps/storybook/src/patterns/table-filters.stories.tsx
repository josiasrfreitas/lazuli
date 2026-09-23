import type { Meta, StoryObj } from "@storybook/nextjs";
import { useEffect, useState, type ReactElement } from "react";
import {
  CalendarDays,
  CircleDollarSign,
  CircleCheck,
  FileText,
  GraduationCap,
  ListFilter,
  Receipt,
  Search,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import {
  DataTablePage,
  Input,
  TableFilterChips,
  TableFilters,
  type RemoteOptionsResult,
  type TableFilterField,
  type TableFilterOption,
} from "@lazuli/ui";

const meta = {
  title: "Patterns/Table filters",
  args: { scenario: "students" },
  argTypes: {
    scenario: { control: "radio", options: ["students", "installments"] },
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Exemplo de filtros combináveis com aplicação imediata, valores múltiplos e limpeza por campo ou geral. Os dados são locais para validação sem servidor.",
      },
    },
  },
} satisfies Meta<{ scenario: "students" | "installments" }>;
export default meta;
type Story = StoryObj<{ scenario: "students" | "installments" }>;

type FieldConfig = {
  id: string;
  label: string;
  kind: "options" | "period" | "amount" | "toggle";
  promoted?: boolean;
  icon?: LucideIcon;
  options?: { id: string; label: string }[];
};
type DemoRow = { label: string; values: Record<string, string> };
type DemoConfig = { title: string; fields: FieldConfig[]; rows: DemoRow[] };
type DemoState = {
  selected: Record<string, string[]>;
  ranges: Record<string, { from: string; to: string }>;
  toggles: Record<string, boolean>;
};

const installmentDemo: DemoConfig = {
  title: "Parcelas",
  fields: [
    {
      id: "status",
      label: "Situação",
      kind: "options",
      promoted: true,
      icon: CircleCheck,
      options: [
        { id: "PAID", label: "Paga" },
        { id: "OVERDUE", label: "Vencida" },
        { id: "UPCOMING", label: "A vencer" },
      ],
    },
    { id: "due", label: "Vencimento", kind: "period", promoted: true, icon: CalendarDays },
    { id: "amount", label: "Valor (R$)", kind: "amount", icon: CircleDollarSign },
    {
      id: "kind",
      label: "Tipo",
      kind: "options",
      icon: FileText,
      options: [
        { id: "TUITION", label: "Mensalidade do curso regular de inglês" },
        { id: "ENROLLMENT_FEE", label: "Taxa de matrícula e rematrícula" },
        { id: "MATERIAL", label: "Material didático complementar" },
        { id: "OTHER", label: "Outros serviços educacionais" },
      ],
    },
    {
      id: "adjustments",
      label: "Ajustes",
      kind: "toggle",
      icon: ListFilter,
    },
    {
      id: "partialPayment",
      label: "Pagamento parcial",
      kind: "toggle",
      icon: Receipt,
    },
  ],
  rows: [
    {
      label: "Ana Ribeiro · Clara Ribeiro · 05/09/2026 · R$ 280,00 · Paga",
      values: {
        status: "PAID",
        due: "2026-09-05",
        amount: "280",
        kind: "OTHER",
        adjustments: "yes",
        partialPayment: "no",
      },
    },
    {
      label: "Bruno Lima · Davi Lima · 10/09/2026 · R$ 350,00 · Vencida",
      values: {
        status: "OVERDUE",
        due: "2026-09-10",
        amount: "350",
        kind: "MATERIAL",
        adjustments: "no",
        partialPayment: "yes",
      },
    },
    {
      label: "Ana Ribeiro · Clara Ribeiro · 05/10/2026 · R$ 280,00 · A vencer",
      values: {
        status: "UPCOMING",
        due: "2026-10-05",
        amount: "280",
        kind: "TUITION",
        adjustments: "no",
        partialPayment: "no",
      },
    },
  ],
};

const TEACHERS: TableFilterOption[] = [
  "Ana Beatriz Lima",
  "André Costa",
  "Bianca Ferreira",
  "Bruna Martins",
  "Camila Rocha",
  "Carla Nogueira",
  "Cláudia Ribeiro",
  "Daniel Alves",
  "Débora Silva",
  "Eduardo Melo",
  "Fernanda Prado",
  "Gabriel Souza",
  "Helena Duarte",
  "Isabela Freitas",
  "Joana Almeida",
  "João Pedro",
  "Juliana Castro",
  "Larissa Gomes",
  "Lucas Pereira",
  "Marcos Vinícius",
  "Mariana Lopes",
  "Mateus Oliveira",
  "Paula Fernandes",
  "Rafael Barbosa",
  "Renata Dias",
  "Sofia Carvalho",
  "Thiago Moreira",
].map((label, index) => ({ id: `teacher-${index + 1}`, label }));

const CLASSES: TableFilterOption[] = [
  { id: "class-a", label: "Inglês A1 · manhã" },
  { id: "class-b", label: "Inglês A2 · tarde" },
  { id: "class-c", label: "Inglês B1 · noite" },
  { id: "class-d", label: "Conversação · sábado" },
];

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

function useMockRemoteOptions({
  all,
  search,
  errorExample = false,
}: {
  all: TableFilterOption[];
  search: string;
  errorExample?: boolean;
}): RemoteOptionsResult {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<RemoteOptionsResult>({ status: "idle", query: "" });
  useEffect(() => {
    const query = search.trim();
    if (!query) return;
    const timeout = window.setTimeout(() => {
      if (errorExample && normalized(query) === "erro" && attempt === 0) {
        setResult({ status: "error", query, onRetry: () => setAttempt((value) => value + 1) });
        return;
      }
      const matches = all.filter((option) => normalized(option.label).includes(normalized(query)));
      setResult({
        status: "ready",
        query,
        options: matches.slice(0, 20),
        hasMore: matches.length > 20,
      });
    }, 250 + 180);
    return () => window.clearTimeout(timeout);
  }, [all, attempt, errorExample, search]);
  const query = search.trim();
  if (!query) {
    return {
      status: "ready",
      query: "",
      options: all.slice(0, 20),
      hasMore: all.length > 20,
    };
  }
  return result.query === query ? result : { status: "loading", query };
}

function toFields({
  config,
  state,
  setState,
}: {
  config: DemoConfig;
  state: DemoState;
  setState: (next: DemoState) => void;
}): TableFilterField[] {
  return config.fields.map((field) => {
    const base = {
      id: field.id,
      label: field.label,
      ...(field.icon ? { icon: field.icon } : {}),
      ...(field.promoted ? { promoted: true } : {}),
    };
    if (field.kind === "options") {
      return {
        ...base,
        kind: "options",
        options: field.options ?? [],
        selected: state.selected[field.id] ?? [],
        onChange: (values: string[]) =>
          setState({ ...state, selected: { ...state.selected, [field.id]: values } }),
        onClear: () => setState({ ...state, selected: { ...state.selected, [field.id]: [] } }),
      };
    }
    if (field.kind === "toggle") {
      return {
        ...base,
        kind: "toggle",
        checked: state.toggles[field.id] ?? false,
        onChange: (checked: boolean) =>
          setState({ ...state, toggles: { ...state.toggles, [field.id]: checked } }),
        onClear: () => setState({ ...state, toggles: { ...state.toggles, [field.id]: false } }),
      };
    }
    const range = state.ranges[field.id] ?? { from: "", to: "" };
    return {
      ...base,
      kind: field.kind,
      ...range,
      onChange: (from: string, to: string) =>
        setState({ ...state, ranges: { ...state.ranges, [field.id]: { from, to } } }),
      onClear: () =>
        setState({ ...state, ranges: { ...state.ranges, [field.id]: { from: "", to: "" } } }),
    };
  });
}

function above({ value, from, amount }: { value: string; from: string; amount: boolean }): boolean {
  if (from === "") return true;
  return amount ? Number(value) >= Number(from) : value >= from;
}

function below({ value, to, amount }: { value: string; to: string; amount: boolean }): boolean {
  if (to === "") return true;
  return amount ? Number(value) <= Number(to) : value <= to;
}

function matchesField({
  row,
  field,
  state,
}: {
  row: DemoRow;
  field: FieldConfig;
  state: DemoState;
}): boolean {
  const value = row.values[field.id] ?? "";
  if (field.kind === "toggle") return !state.toggles[field.id] || value === "yes";
  if (field.kind === "options") {
    const selected = state.selected[field.id] ?? [];
    return selected.length === 0 || selected.includes(value);
  }
  const { from, to } = state.ranges[field.id] ?? { from: "", to: "" };
  const amount = field.kind === "amount";
  return above({ value, from, amount }) && below({ value, to, amount });
}

function DemoControls({
  fields,
  onClearAll,
  search,
  setSearch,
}: {
  fields: TableFilterField[];
  onClearAll: () => void;
  search: string;
  setSearch: (value: string) => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="relative w-full sm:w-72">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label="Buscar"
          className="pl-8"
          size="sm"
          type="search"
          placeholder="Buscar"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <TableFilters fields={fields} onClearAll={onClearAll} />
    </div>
  );
}

function Demo({ config }: { config: DemoConfig }): ReactElement {
  const [state, setState] = useState<DemoState>({
    selected: { status: ["OVERDUE"], kind: ["MATERIAL", "TUITION", "OTHER"] },
    ranges: {},
    toggles: { partialPayment: true },
  });
  const [search, setSearch] = useState("");
  const fields = toFields({ config, state, setState });
  const visible = config.rows.filter(
    (row) =>
      row.label.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")) &&
      config.fields.every((field) => matchesField({ row, field, state })),
  );
  return (
    <div className="min-h-screen w-full min-w-0 bg-background">
      <DataTablePage
        header={<h1 className="font-display text-2xl font-semibold">{config.title}</h1>}
        controls={
          <DemoControls
            fields={fields}
            onClearAll={() => setState({ selected: {}, ranges: {}, toggles: {} })}
            search={search}
            setSearch={setSearch}
          />
        }
      >
        <div className="min-w-0 space-y-2">
          <TableFilterChips fields={fields} />
          <div className="space-y-2 rounded-lg border border-border p-4">
            <p role="status">{visible.length} resultados</p>
            {visible.map((row) => (
              <div key={row.label} className="border-t border-border pt-2">
                {row.label}
              </div>
            ))}
          </div>
        </div>
      </DataTablePage>
    </div>
  );
}

const STUDENT_ROWS = [
  {
    label: "Ana Ribeiro · Inglês A1 · Bruna Martins · Ativo",
    status: "active",
    classId: "class-a",
    teacherId: "teacher-4",
    registered: "2026-03-10",
  },
  {
    label: "Bruno Lima · Inglês A2 · Mariana Lopes · Ativo",
    status: "active",
    classId: "class-b",
    teacherId: "teacher-21",
    registered: "2026-04-12",
  },
  {
    label: "Clara Oliveira · Inglês B1 · Marcos Vinícius · Inativo",
    status: "inactive",
    classId: "class-c",
    teacherId: "teacher-20",
    registered: "2026-02-01",
  },
  {
    label: "Davi Gomes · Conversação · Mariana Lopes · Ativo",
    status: "active",
    classId: "class-d",
    teacherId: "teacher-21",
    registered: "2026-05-20",
  },
];

function StudentDemo(): ReactElement {
  const [selected, setSelected] = useState<Record<string, string[]>>({
    situations: ["active"],
    teachers: ["teacher-4"],
  });
  const [registered, setRegistered] = useState({ from: "", to: "" });
  const [search, setSearch] = useState("");
  const [classSearch, setClassSearch] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const classIds = selected.classes ?? [];
  const teacherIds = selected.teachers ?? [];
  const situations = selected.situations ?? [];
  const classes = useMockRemoteOptions({ all: CLASSES, search: classSearch });
  const teachers = useMockRemoteOptions({
    all: TEACHERS,
    search: teacherSearch,
    errorExample: true,
  });
  const changeSelection = (id: string, values: string[]): void =>
    setSelected((current) => ({ ...current, [id]: values }));
  const fields: TableFilterField[] = [
    {
      id: "situations",
      label: "Situação",
      kind: "options",
      icon: CircleCheck,
      promoted: true,
      options: [
        { id: "active", label: "Ativo" },
        { id: "inactive", label: "Inativo" },
      ],
      selected: situations,
      onChange: (values) => changeSelection("situations", values),
      onClear: () => changeSelection("situations", []),
    },
    {
      id: "classes",
      label: "Turma",
      kind: "remote-options",
      promoted: true,
      icon: UsersRound,
      selected: classIds,
      selectedOptions: CLASSES.filter((option) => classIds.includes(option.id)),
      search: classSearch,
      result: classes,
      onSearchChange: setClassSearch,
      onChange: (values) => changeSelection("classes", values),
      onClear: () => changeSelection("classes", []),
    },
    {
      id: "teachers",
      label: "Professor",
      kind: "remote-options",
      icon: GraduationCap,
      selected: teacherIds,
      selectedOptions: TEACHERS.filter((option) => teacherIds.includes(option.id)),
      search: teacherSearch,
      result: teachers,
      onSearchChange: setTeacherSearch,
      onChange: (values) => changeSelection("teachers", values),
      onClear: () => changeSelection("teachers", []),
    },
    {
      id: "registered",
      label: "Data de cadastro",
      kind: "period",
      icon: CalendarDays,
      from: registered.from,
      to: registered.to,
      onChange: (from, to) => setRegistered({ from, to }),
      onClear: () => setRegistered({ from: "", to: "" }),
    },
  ];
  const visible = STUDENT_ROWS.filter(
    (row) =>
      row.label.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")) &&
      (!situations.length || situations.includes(row.status)) &&
      (!classIds.length || classIds.includes(row.classId)) &&
      (!teacherIds.length || teacherIds.includes(row.teacherId)) &&
      (!registered.from || row.registered >= registered.from) &&
      (!registered.to || row.registered <= registered.to),
  );
  return (
    <div className="min-h-screen w-full min-w-0 bg-background">
      <DataTablePage
        header={<h1 className="font-display text-2xl font-semibold">Alunos</h1>}
        controls={
          <DemoControls
            fields={fields}
            onClearAll={() => {
              setSelected({});
              setRegistered({ from: "", to: "" });
            }}
            search={search}
            setSearch={setSearch}
          />
        }
      >
        <div className="min-w-0 space-y-2">
          <TableFilterChips fields={fields} />
          <div className="space-y-2 rounded-lg border border-border p-4">
            <p role="status">{visible.length} resultados</p>
            {visible.map((row) => (
              <div key={row.label} className="border-t border-border pt-2">
                {row.label}
              </div>
            ))}
          </div>
        </div>
      </DataTablePage>
    </div>
  );
}

export const Playground: Story = {
  render: ({ scenario }) =>
    scenario === "students" ? <StudentDemo /> : <Demo config={installmentDemo} />,
};
