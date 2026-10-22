import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState, type ReactElement } from "react";
import { BookOpen, DollarSign, Search, UserRound } from "lucide-react";
import { Button, CommandMenu, type CommandMenuProps } from "@lazuli/ui";

const SCOPED_ITEMS: CommandMenuProps["items"] = [
  {
    id: "pedagogy",
    label: "Abrir Pedagógico",
    description: "Matrícula, frequência e acompanhamento",
    group: "Destinos do aluno",
    icon: <BookOpen />,
  },
  {
    id: "finance",
    label: "Abrir Financeiro",
    description: "Saldos, parcelas e tratativas",
    group: "Destinos do aluno",
    icon: <DollarSign />,
  },
];
const DEFAULT_ITEMS: CommandMenuProps["items"] = [
  {
    id: "student",
    label: "João — aluno de exemplo",
    description: "English 2 · Terça e quinta",
    group: "Melhor resultado",
    icon: <UserRound />,
    expandable: true,
    hint: "Pedagógico",
  },
  {
    id: "overview",
    label: "Financeiro",
    description: "Visão geral financeira",
    group: "Outros destinos",
    icon: <DollarSign />,
  },
];

function Example({
  pending = false,
  error = false,
  empty = false,
}: {
  pending?: boolean;
  error?: boolean;
  empty?: boolean;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scoped, setScoped] = useState(false);
  const items = scoped ? SCOPED_ITEMS : DEFAULT_ITEMS;
  return (
    <CommandMenu
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="secondary">
          <Search />
          Buscar no sistema
        </Button>
      }
      query={query}
      onQueryChange={setQuery}
      items={empty ? [] : items}
      onSelect={() => setOpen(false)}
      onExpand={() => {
        setScoped(true);
        setQuery("");
      }}
      onBack={() => {
        setScoped(false);
        setQuery("");
      }}
      scope={
        scoped
          ? { title: "João — aluno de exemplo", description: "English 2 · Terça e quinta" }
          : undefined
      }
      pending={pending}
      error={error}
      onRetry={() => {}}
    />
  );
}
const meta = { title: "Components/CommandMenu", component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Loading: Story = { args: { pending: true } };
export const Error: Story = { args: { error: true } };
export const Empty: Story = { args: { empty: true } };
