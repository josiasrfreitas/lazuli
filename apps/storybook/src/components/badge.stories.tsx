import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, within } from "storybook/test";

import { Badge } from "@lazuli/ui";

const statuses = [
  { label: "Arquivado", variant: "neutral" },
  { label: "Pago", variant: "success" },
  { label: "Pendente", variant: "warning" },
  { label: "Em atraso", variant: "destructive" },
  { label: "Em análise", variant: "info" },
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
      options: ["neutral", "success", "warning", "destructive", "info"],
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

export const Themes: Story = {
  parameters: { backgrounds: { disable: true } },
  render: () => (
    <div className="grid overflow-hidden rounded-lg border md:grid-cols-2">
      {[
        { label: "Tema claro", theme: "light" },
        { label: "Tema escuro", theme: "dark" },
      ].map(({ label, theme }) => (
        <section className={`${theme} bg-background p-5 text-foreground`} key={theme}>
          <h2 className="mb-4 font-display text-caption font-semibold">{label}</h2>
          <div className="flex max-w-64 flex-wrap gap-2">
            {statuses.map((status) => (
              <Badge key={status.variant} variant={status.variant}>
                {status.label}
              </Badge>
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
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
