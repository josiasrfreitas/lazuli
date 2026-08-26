import type { Meta, StoryObj } from "@storybook/nextjs";
import { UserRoundSearch } from "lucide-react";
import { expect, within } from "storybook/test";

import { Button, EmptyState } from "@lazuli/ui";

const meta = {
  title: "Components/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Mensagem centrada para listas vazias ou filtros sem resultado, com ação opcional.",
      },
    },
  },
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

const noResultsTitle = "Nenhum aluno encontrado";

export const Playground: Story = {
  args: {
    icon: <UserRoundSearch />,
    title: noResultsTitle,
    description: "Ajuste a busca ou limpe os filtros para ver a lista completa.",
    action: <Button variant="secondary">Limpar filtros</Button>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(noResultsTitle)).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Limpar filtros" })).toBeVisible();
  },
};

export const WithoutAction: Story = {
  args: {
    icon: <UserRoundSearch />,
    title: noResultsTitle,
    description: "Ajuste a busca ou limpe os filtros para ver a lista completa.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(noResultsTitle)).toBeVisible();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

export const TitleOnly: Story = {
  args: {
    title: "Nenhum aluno cadastrado",
  },
};
