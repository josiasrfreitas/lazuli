import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState, type ReactElement } from "react";
import { CalendarDays, CircleCheck, GraduationCap, UsersRound } from "lucide-react";
import {
  DataTablePage,
  TableFilterChips,
  TableFilters,
  type RemoteOptionsResult,
  type TableFilterField,
  type TableFilterOption,
} from "@lazuli/ui";

const meta = {
  title: "Patterns/Table filters",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const INSTALLMENT_OPTIONS: TableFilterOption[] = [
  { id: "OVERDUE", label: "Vencida" },
  { id: "DUE_THIS_MONTH", label: "Vence este mês" },
  { id: "UPCOMING", label: "A vencer" },
  { id: "PAID", label: "Paga" },
  { id: "WAIVED", label: "Dispensada" },
];
const STUDENT_OPTIONS: TableFilterOption[] = [
  { id: "active", label: "Ativo" },
  { id: "inactive", label: "Inativo" },
];
const CLASS_OPTIONS: TableFilterOption[] = [
  { id: "class-a", label: "Inglês A1 · manhã" },
  { id: "class-b", label: "Inglês B1 · noite" },
];
const TEACHER_OPTIONS: TableFilterOption[] = [
  { id: "teacher-a", label: "Ana Martins" },
  { id: "teacher-b", label: "Bruno Costa" },
];

type DemoState = {
  selected: Record<string, string[]>;
  ranges: Record<string, { from: string; to: string }>;
  searches: Record<string, string>;
  setSelected: (id: string, values: string[]) => void;
  setRange: (id: string, range: { from: string; to: string }) => void;
  setSearch: (id: string, value: string) => void;
};

function useDemoState(): DemoState {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [ranges, setRanges] = useState<Record<string, { from: string; to: string }>>({});
  const [searches, setSearches] = useState<Record<string, string>>({});
  return {
    selected,
    ranges,
    searches,
    setSelected: (id, values) => setSelected((current) => ({ ...current, [id]: values })),
    setRange: (id, range) => setRanges((current) => ({ ...current, [id]: range })),
    setSearch: (id, value) => setSearches((current) => ({ ...current, [id]: value })),
  };
}

function remoteResult(query: string, options: TableFilterOption[]): RemoteOptionsResult {
  const search = query.trim();
  if (search === "") return { status: "idle", query: "" };
  const matches = options.filter((option) =>
    option.label.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")),
  );
  return { status: "ready", query: search, options: matches, hasMore: false };
}

function remoteField({
  id,
  label,
  options,
  state,
}: {
  id: string;
  label: string;
  options: TableFilterOption[];
  state: DemoState;
}): TableFilterField {
  const selected = state.selected[id] ?? [];
  const search = state.searches[id] ?? "";
  return {
    id,
    label,
    kind: "remote-options",
    promoted: id === "classes",
    icon: id === "classes" ? UsersRound : GraduationCap,
    selected,
    selectedOptions: options.filter((option) => selected.includes(option.id)),
    search,
    result: remoteResult(search, options),
    onSearchChange: (value) => state.setSearch(id, value),
    onChange: (values) => state.setSelected(id, values),
    onClear: () => state.setSelected(id, []),
  };
}

function situationField(options: TableFilterOption[], state: DemoState): TableFilterField {
  return {
    id: "situations",
    label: "Situação",
    kind: "options",
    icon: CircleCheck,
    promoted: true,
    options,
    selected: state.selected.situations ?? [],
    onChange: (values) => state.setSelected("situations", values),
    onClear: () => state.setSelected("situations", []),
  };
}

function periodField({
  id,
  label,
  promoted,
  state,
}: {
  id: string;
  label: string;
  promoted: boolean;
  state: DemoState;
}): TableFilterField {
  const range = state.ranges[id] ?? { from: "", to: "" };
  return {
    id,
    label,
    kind: "period",
    icon: CalendarDays,
    promoted,
    ...range,
    onChange: (from, to) => state.setRange(id, { from, to }),
    onClear: () => state.setRange(id, { from: "", to: "" }),
  };
}

function installmentFields(state: DemoState): TableFilterField[] {
  const amount = state.ranges.amount ?? { from: "", to: "" };
  return [
    situationField(INSTALLMENT_OPTIONS, state),
    periodField({ id: "due", label: "Vencimento", promoted: true, state }),
    {
      id: "amount",
      label: "Valor (R$)",
      kind: "amount",
      ...amount,
      onChange: (from, to) => state.setRange("amount", { from, to }),
      onClear: () => state.setRange("amount", { from: "", to: "" }),
    },
  ];
}

function studentFields(state: DemoState): TableFilterField[] {
  return [
    situationField(STUDENT_OPTIONS, state),
    remoteField({ id: "classes", label: "Turma", options: CLASS_OPTIONS, state }),
    remoteField({ id: "teachers", label: "Professor", options: TEACHER_OPTIONS, state }),
    periodField({ id: "registered", label: "Data de cadastro", promoted: false, state }),
  ];
}

function Demo({ kind }: { kind: "installments" | "students" }): ReactElement {
  const state = useDemoState();
  const title = kind === "installments" ? "Parcelas" : "Alunos";
  const fields = kind === "installments" ? installmentFields(state) : studentFields(state);
  const clearAll = (): void => {
    for (const field of fields) field.onClear();
  };
  return (
    <div className="min-h-screen bg-background p-4">
      <DataTablePage
        title={title}
        controls={<TableFilters fields={fields} onClearAll={clearAll} />}
      >
        <div className="space-y-3">
          <TableFilterChips fields={fields} />
          <div className="rounded-lg border border-border bg-card p-4 text-muted-foreground">
            Experimente selecionar, combinar e remover filtros.
          </div>
        </div>
      </DataTablePage>
    </div>
  );
}

export const Parcelas: Story = { render: () => <Demo kind="installments" /> };
export const Alunos: Story = { render: () => <Demo kind="students" /> };
