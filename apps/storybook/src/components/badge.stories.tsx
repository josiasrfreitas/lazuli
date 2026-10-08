import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, within } from "storybook/test";

import { Badge } from "@lazuli/ui";

const statuses = [
  { label: "Arquivado", variant: "neutral" },
  { label: "Pago", variant: "success" },
  { label: "Pendente", variant: "warning" },
  { label: "Em atraso", variant: "destructive" },
  { label: "Em análise", variant: "info" },
  { label: "Acima da referência", variant: "over-capacity" },
] as const;

const semanticHierarchy = [
  {
    meaning: "Repouso ou inatividade",
    feeling: "Sem ação necessária",
    label: "Não habilitado",
    variant: "neutral",
  },
  {
    meaning: "Informação",
    feeling: "Contexto para a operação",
    label: "Substituição",
    variant: "info",
  },
  { meaning: "Confirmação", feeling: "Pronto para uso", label: "Habilitado", variant: "success" },
  {
    meaning: "Atenção",
    feeling: "Preparar ou resolver",
    label: "Saída programada",
    variant: "warning",
  },
  {
    meaning: "Falha ou bloqueio",
    feeling: "Intervenção necessária",
    label: "Conflito de horário",
    variant: "destructive",
  },
] as const;

const meta = {
  title: "Components/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: {
    children: "Ativo",
    variant: "success",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["neutral", "success", "warning", "destructive", "info", "over-capacity"],
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Compact status indicator for tables and summaries. Pair the color cue with a clear pt-BR label.",
      },
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Ativo")).toBeVisible();
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {statuses.map(({ label, variant }) => (
        <Badge key={variant} variant={variant}>
          {label}
        </Badge>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    for (const { label } of statuses) {
      await expect(canvas.getByText(label)).toBeVisible();
    }
  },
};

export const PaymentStatuses: Story = {
  render: () => (
    <div className="w-96 overflow-hidden rounded-lg border bg-card text-card-foreground">
      <div className="border-b bg-muted px-4 py-2 text-micro font-semibold uppercase tracking-label text-muted-foreground">
        Parcelas
      </div>
      <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <span className="text-caption">Julho de 2026</span>
        <Badge variant="success">Pago</Badge>
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <span className="text-caption">Agosto de 2026</span>
        <Badge variant="destructive">Em atraso</Badge>
      </div>
    </div>
  ),
};

export const SemanticHierarchy: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Neutral is the quiet baseline. Info and success provide context and confidence. Warning asks for attention; destructive marks failure or blocking conditions. Disabled access can be intentional and uses neutral. Always pair color with an explicit label. See docs/frontend/semantic-colors.md.",
      },
    },
  },
  render: () => (
    <div className="grid w-full gap-4 lg:grid-cols-2">
      {(["light", "dark"] as const).map((theme) => (
        <section
          key={theme}
          className={`${theme} rounded-md border border-border bg-card p-4 text-card-foreground`}
        >
          <h2 className="mb-3 text-control font-semibold">
            {theme === "light" ? "Tema claro" : "Tema escuro"}
          </h2>
          <div className="divide-y divide-border">
            {semanticHierarchy.map(({ meaning, feeling, label, variant }) => (
              <div key={variant} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-control font-medium">{meaning}</p>
                  <p className="text-caption text-muted-foreground">{feeling}</p>
                </div>
                <Badge variant={variant}>{label}</Badge>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};
