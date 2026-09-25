import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, userEvent, within } from "storybook/test";
import { DataTable, type DataTableColumn } from "@lazuli/ui";

type Row = { id: string; name: string; amount: string };
const columns: readonly DataTableColumn<Row>[] = [
  { id: "name", header: "Aluno", width: "wide", cell: (row) => row.name },
  { id: "amount", header: "Mensalidade", numeric: true, cell: (row) => row.amount },
];
const meta = {
  title: "Components/DataTable",
  component: DataTable<Row>,
  parameters: { layout: "fullscreen" },
  args: {
    label: "Contratos de exemplo",
    columns,
    state: { kind: "data", rows: [{ id: "example", name: "Ana", amount: "R$ 250,00" }] },
    pagination: { page: 1, pageSize: 10, pageCount: 1, totalItems: 1 },
    empty: { title: "Nenhum contrato cadastrado", description: "Crie o primeiro contrato." },
    errorTitle: "Não foi possível carregar os contratos",
    onRetry: fn(),
  },
  render: (args) => (
    <div className="h-96 p-6">
      <DataTable {...args} />
    </div>
  ),
} satisfies Meta<typeof DataTable<Row>>;
export default meta;
type Story = StoryObj<typeof meta>;
const STANDARD_ROW_HEIGHT = 48;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole("columnheader", { name: "Aluno" });
    const cell = canvas.getByRole("cell", { name: "Ana" });
    await expect(header.getBoundingClientRect().height).toBe(STANDARD_ROW_HEIGHT);
    await expect(cell.getBoundingClientRect().height).toBe(STANDARD_ROW_HEIGHT);
    await expect(canvas.getByRole("navigation", { name: "Paginação" })).toBeVisible();
  },
};
export const Loading: Story = {
  args: { state: { kind: "loading" }, pagination: { loading: true, page: 1, pageSize: 10 } },
};
export const Empty: Story = { args: { state: { kind: "empty" } } };
export const NoResults: Story = { args: { state: { kind: "noResults" } } };
export const Error: Story = {
  args: { state: { kind: "error" } },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Tentar de novo" }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};
