import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ReactElement } from "react";
import { expect, userEvent, within } from "storybook/test";

import { Pagination } from "@lazuli/ui";

const meta = {
  title: "Components/Pagination",
  component: Pagination,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Paginação anterior/próxima com indicador de página. O chamador controla o estado; os botões desabilitam nas bordas.",
      },
    },
  },
} satisfies Meta<typeof Pagination>;

export default meta;

type Story = StoryObj<typeof meta>;

const totalPages = 12;
const previousName = "Página anterior";
const nextName = "Próxima página";

function ControlledPagination({ initialPage }: { initialPage: number }): ReactElement {
  const [page, setPage] = useState(initialPage);

  return <Pagination onPageChange={setPage} page={page} pageCount={totalPages} />;
}

export const Playground: Story = {
  args: { page: 3, pageCount: totalPages },
  render: () => <ControlledPagination initialPage={3} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("3")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: nextName }));
    await expect(canvas.getByText("4")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: previousName }));
    await userEvent.click(canvas.getByRole("button", { name: previousName }));
    await expect(canvas.getByText("2")).toBeVisible();
  },
};

export const FirstPage: Story = {
  args: { page: 1, pageCount: totalPages },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("button", { name: previousName })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: nextName })).toBeEnabled();
  },
};

export const LastPage: Story = {
  args: { page: totalPages, pageCount: totalPages },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("button", { name: previousName })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: nextName })).toBeDisabled();
  },
};

export const SinglePage: Story = {
  args: { page: 1, pageCount: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("button", { name: previousName })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: nextName })).toBeDisabled();
  },
};
