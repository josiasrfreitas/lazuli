import type { Meta, StoryObj } from "@storybook/nextjs";
import { Plus } from "lucide-react";
import type { ReactElement } from "react";
import { expect, waitFor, within } from "storybook/test";

import {
  Button,
  DataTablePage,
  Input,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
} from "@lazuli/ui";

const ROW_COUNT = 24;
const STATUS_CYCLE = 3;
const PAGE_COUNT = 3;
const PAGE_SIZE = 10;
const MEDIUM_PAGE_SIZE = 25;
const LARGE_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [PAGE_SIZE, MEDIUM_PAGE_SIZE, LARGE_PAGE_SIZE] as const;

const rows = Array.from({ length: ROW_COUNT }, (_unused, index) => ({
  id: index + 1,
  name: `Aluno ${String(index + 1).padStart(2, "0")}`,
  status: index % STATUS_CYCLE === 0 ? "Pendente" : "Ativo",
}));

const meta = {
  title: "Patterns/Data table page",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Layout padrão para listagens operacionais: cabeçalho e filtros permanecem visíveis enquanto somente a moldura da tabela rola.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function ExampleHeader(): ReactElement {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-h2 font-semibold">Alunos</h1>
        <p className="mt-1 text-caption text-muted-foreground">24 alunos cadastrados</p>
      </div>
      <Button>
        <Plus aria-hidden="true" />
        Novo aluno
      </Button>
    </div>
  );
}

function ViewportBoundExample(): ReactElement {
  return (
    <div className="h-[40rem] w-full overflow-hidden bg-background">
      <DataTablePage
        controls={
          <div className="flex items-center justify-between gap-4">
            <Input aria-label="Buscar aluno" className="w-80" placeholder="Buscar aluno" />
            <span className="text-caption text-muted-foreground">Todos · Ativos · Pendentes</span>
          </div>
        }
        header={<ExampleHeader />}
      >
        <TableContainer
          data-testid="table-frame"
          footer={
            <TablePagination
              itemLabel={{ singular: "aluno", plural: "alunos" }}
              page={1}
              pageCount={PAGE_COUNT}
              pageSize={PAGE_SIZE}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              totalItems={ROW_COUNT}
            />
          }
          viewportBound
        >
          <Table aria-label="Exemplo de alunos">
            <TableHeader sticky>
              <TableRow className="hover:bg-transparent">
                <TableHead>Aluno</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DataTablePage>
    </div>
  );
}

export const ViewportBound: Story = {
  render: () => <ViewportBoundExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frame = canvas.getByTestId("table-frame");
    const viewport = frame.querySelector<HTMLElement>('[data-slot="table-viewport"]');
    const header = frame.querySelector("thead");
    const pagination = frame.querySelector('[data-slot="table-pagination"]');

    await expect(viewport).not.toBeNull();
    await expect(header).not.toBeNull();
    await expect(pagination).not.toBeNull();
    if (viewport === null || header === null || pagination === null) {
      return;
    }

    // Only the data scrolls: the footer is furniture outside the viewport.
    await expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    await expect(viewport.contains(pagination)).toBe(false);

    // The scrollbar is confined to the data: it starts under the sticky
    // header and ends where the footer begins.
    await waitFor(async () => {
      const scrollbar = frame.querySelector('[data-orientation="vertical"]');
      await expect(scrollbar).not.toBeNull();
      const scrollbarRect = (scrollbar as HTMLElement).getBoundingClientRect();
      await expect(scrollbarRect.height).toBeGreaterThan(0);
      await expect(scrollbarRect.top).toBeGreaterThanOrEqual(
        header.getBoundingClientRect().bottom - 1,
      );
      await expect(scrollbarRect.bottom).toBeLessThanOrEqual(
        pagination.getBoundingClientRect().top + 1,
      );
    });

    await expect(canvas.getByRole("button", { name: "Novo aluno" })).toBeVisible();
    await expect(canvas.getByRole("searchbox", { name: "Buscar aluno" })).toBeVisible();
  },
};
