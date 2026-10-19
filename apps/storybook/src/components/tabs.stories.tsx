import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ReactElement } from "react";
import { expect, userEvent, within } from "storybook/test";

import { Tabs, TabsList, TabsPanel, TabsTab, type TabsSize, type TabsVariant } from "@lazuli/ui";

const meta = {
  title: "Components/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Alterna entre visões do mesmo conjunto de dados. Use links e rotas quando as seções forem páginas distintas.",
      },
    },
  },
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;

const situations = [
  { label: "Ativos", panel: "12 contratos ativos.", value: "ativos" },
  { label: "Atrasados", panel: "3 contratos atrasados.", value: "atrasados" },
  { label: "Encerrados", panel: "8 contratos encerrados.", value: "encerrados" },
];

function ContractTabs({
  size = "sm",
  variant = "segmented",
}: {
  size?: TabsSize;
  variant?: TabsVariant;
}): ReactElement {
  return (
    <Tabs defaultValue="ativos" size={size} variant={variant}>
      <TabsList>
        {situations.map((situation) => (
          <TabsTab key={situation.value} value={situation.value}>
            {situation.label}
          </TabsTab>
        ))}
      </TabsList>
      {situations.map((situation) => (
        <TabsPanel className="text-caption" key={situation.value} value={situation.value}>
          {situation.panel}
        </TabsPanel>
      ))}
    </Tabs>
  );
}

export const Playground: Story = {
  render: () => <ContractTabs />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("tab", { name: "Ativos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await userEvent.click(canvas.getByRole("tab", { name: "Atrasados" }));

    await expect(canvas.getByRole("tab", { name: "Atrasados" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent("3 contratos atrasados.");
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-10 p-8">
      <ContractTabs variant="segmented" />
      <ContractTabs variant="underline" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-10 p-8">
      <ContractTabs size="sm" />
      <ContractTabs size="md" />
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-10 p-8">
      <Tabs defaultValue="ativos">
        <TabsList>
          <TabsTab value="ativos">Ativos</TabsTab>
          <TabsTab value="atrasados">Atrasados</TabsTab>
          <TabsTab disabled value="arquivados">
            Arquivados
          </TabsTab>
        </TabsList>
        <TabsPanel className="text-caption" value="ativos">
          Uma aba indisponível permanece visível, mas não recebe foco nem seleção.
        </TabsPanel>
        <TabsPanel className="text-caption" value="atrasados">
          3 contratos atrasados.
        </TabsPanel>
      </Tabs>
      <Tabs defaultValue="ativos" variant="underline">
        <TabsList>
          <TabsTab value="ativos">Ativos</TabsTab>
          <TabsTab value="atrasados">Atrasados</TabsTab>
          <TabsTab disabled value="arquivados">
            Arquivados
          </TabsTab>
        </TabsList>
        <TabsPanel className="text-caption" value="ativos">
          Mesma regra na variação com sublinhado.
        </TabsPanel>
        <TabsPanel className="text-caption" value="atrasados">
          3 contratos atrasados.
        </TabsPanel>
      </Tabs>
    </div>
  ),
};

export const StickyNavigation: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Navigation scrolls with the brief until it reaches the scroll container's top. Only panel content continues past it. Keep the tabs root at least as tall as the scroll container to preserve this position for short panels.",
      },
    },
  },
  render: () => (
    <div className="h-80 overflow-y-auto bg-background">
      <div className="px-5 py-6">
        <h2 className="font-display text-2xl">REG 14:00 · 5</h2>
        <p className="text-sm text-muted-foreground">2026.2 · Regular · Presencial</p>
      </div>
      <Tabs defaultValue="alunos" variant="underline" size="md" className="min-h-80">
        <TabsList sticky aria-label="Seções da turma">
          <TabsTab value="alunos">Alunos</TabsTab>
          <TabsTab value="desempenho">Desempenho</TabsTab>
        </TabsList>
        <TabsPanel value="alunos">
          <ol className="divide-y divide-border">
            {Array.from({ length: 12 }, (_item, index) => (
              <li key={index} className="px-5 py-4">
                Aluno {index + 1}
              </li>
            ))}
          </ol>
        </TabsPanel>
        <TabsPanel value="desempenho">Nenhuma avaliação registrada.</TabsPanel>
      </Tabs>
    </div>
  ),
};
