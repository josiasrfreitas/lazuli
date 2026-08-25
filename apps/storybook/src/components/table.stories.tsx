import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ReactElement, ReactNode } from "react";
import { useState } from "react";

import { MoreHorizontal } from "lucide-react";
import { expect, userEvent, within } from "storybook/test";

import {
  Badge,
  type BadgeVariant,
  Button,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableContainer,
  type TableDensity,
  TableEmpty,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
  type TableSortDirection,
} from "@lazuli/ui";

const meta = {
  title: "Components/Table",
  component: Table,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Tabela semântica para dados operacionais: densidades padrão e compacta, cabeçalho ordenável, seleção de linhas, valores numéricos alinhados à direita e estados vazio, carregando, erro e sem resultados dentro da própria moldura.",
      },
    },
  },
} satisfies Meta<typeof Table>;

export default meta;

type Story = StoryObj<typeof meta>;

interface Installment {
  amount: string;
  due: string;
  id: string;
  status: { label: string; variant: BadgeVariant };
  student: string;
}

const installments: Installment[] = [
  {
    amount: "R$ 480,00",
    due: "10/08/2026",
    id: "1",
    status: { label: "Pago", variant: "success" },
    student: "Ana Souza",
  },
  {
    amount: "R$ 1.250,00",
    due: "05/08/2026",
    id: "2",
    status: { label: "Atrasado", variant: "destructive" },
    student: "Bernardo Nogueira de Alencar Filho",
  },
  {
    amount: "R$ 320,00",
    due: "20/08/2026",
    id: "3",
    status: { label: "Em aberto", variant: "warning" },
    student: "Carla Menezes",
  },
];

function InstallmentRows({ density = "default" }: { density?: TableDensity }): ReactElement {
  return (
    <TableContainer>
      <Table aria-label="Parcelas" density={density}>
        <TableHeader>
          <TableRow>
            <TableHead>Aluno</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead numeric>Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {installments.map((installment) => (
            <TableRow key={installment.id}>
              <TableCell className="font-medium">{installment.student}</TableCell>
              <TableCell className="text-muted-foreground">{installment.due}</TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge variant={installment.status.variant}>{installment.status.label}</Badge>
              </TableCell>
              <TableCell numeric>{installment.amount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function orderByStudent(direction: TableSortDirection): Installment[] {
  const rows = [...installments];

  rows.sort((first, second) =>
    direction === "ascending"
      ? first.student.localeCompare(second.student, "pt-BR")
      : second.student.localeCompare(first.student, "pt-BR"),
  );

  return rows;
}

function SortableTable(): ReactElement {
  const [direction, setDirection] = useState<TableSortDirection>("ascending");
  const ordered = orderByStudent(direction);

  return (
    <TableContainer>
      <Table aria-label="Parcelas ordenáveis">
        <TableHeader>
          <TableRow>
            <TableHead
              onSort={() => setDirection(direction === "ascending" ? "descending" : "ascending")}
              sortDirection={direction}
            >
              Aluno
            </TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead numeric>Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordered.map((installment) => (
            <TableRow key={installment.id}>
              <TableCell className="font-medium">{installment.student}</TableCell>
              <TableCell className="text-muted-foreground">{installment.due}</TableCell>
              <TableCell numeric>{installment.amount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function SelectionTable(): ReactElement {
  const [selected, setSelected] = useState<string[]>(["2"]);
  const toggle = (id: string): void =>
    setSelected(selected.includes(id) ? selected.filter((it) => it !== id) : [...selected, id]);

  return (
    <TableContainer>
      <Table aria-label="Parcelas selecionáveis">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <span className="sr-only">Seleção</span>
            </TableHead>
            <TableHead>Aluno</TableHead>
            <TableHead numeric>Valor</TableHead>
            <TableHead className="w-14">
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {installments.map((installment) => (
            <TableRow key={installment.id} selected={selected.includes(installment.id)}>
              <TableCell>
                <input
                  aria-label={`Selecionar ${installment.student}`}
                  checked={selected.includes(installment.id)}
                  onChange={() => toggle(installment.id)}
                  type="checkbox"
                />
              </TableCell>
              <TableCell className="font-medium">{installment.student}</TableCell>
              <TableCell numeric>{installment.amount}</TableCell>
              <TableCell>
                <Button
                  aria-label={`Ações de ${installment.student}`}
                  size="icon-sm"
                  variant="ghost"
                >
                  <MoreHorizontal />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function MessageTable({ children, label }: { children: ReactNode; label: string }): ReactElement {
  return (
    <TableContainer>
      <Table aria-label={label}>
        <TableHeader>
          <TableRow>
            <TableHead>Aluno</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead numeric>Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty colSpan={3}>{children}</TableEmpty>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function LoadingTable(): ReactElement {
  return (
    <TableContainer>
      <Table aria-busy="true" aria-label="Carregando parcelas">
        <TableHeader>
          <TableRow>
            <TableHead>Aluno</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead numeric>Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableSkeleton columns={3} label="Carregando parcelas…" numericColumns={[2]} rows={3} />
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export const Playground: Story = {
  render: () => <InstallmentRows />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("table", { name: "Parcelas" })).toBeInTheDocument();
    await expect(canvas.getAllByRole("row")).toHaveLength(installments.length + 1);
  },
};

export const Densities: Story = {
  render: () => (
    <div className="grid gap-6">
      <InstallmentRows density="default" />
      <InstallmentRows density="compact" />
    </div>
  ),
};

export const Sorting: Story = {
  render: () => <SortableTable />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole("columnheader", { name: /Aluno/u });

    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await userEvent.click(within(header).getByRole("button"));
    await expect(header).toHaveAttribute("aria-sort", "descending");
  },
};

export const Selection: Story = {
  render: () => <SelectionTable />,
};

export const Totals: Story = {
  render: () => (
    <TableContainer>
      <Table aria-label="Parcelas com total">
        <TableCaption>Parcelas de agosto de 2026.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Aluno</TableHead>
            <TableHead numeric>Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {installments.map((installment) => (
            <TableRow key={installment.id}>
              <TableCell className="font-medium">{installment.student}</TableCell>
              <TableCell numeric>{installment.amount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell numeric>R$ 2.050,00</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </TableContainer>
  ),
};

export const Loading: Story = {
  render: () => <LoadingTable />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("status")).toHaveTextContent("Carregando parcelas");
    await expect(canvas.getByRole("table", { name: "Carregando parcelas" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  },
};

export const States: Story = {
  render: () => (
    <div className="grid gap-6">
      <MessageTable label="Sem parcelas">Nenhuma parcela cadastrada ainda.</MessageTable>
      <LoadingTable />
      <MessageTable label="Erro ao carregar parcelas">
        <span className="text-destructive">
          Não foi possível carregar as parcelas. Tente novamente.
        </span>
      </MessageTable>
      <MessageTable label="Sem resultados para o filtro">
        Nenhuma parcela corresponde aos filtros aplicados.
      </MessageTable>
    </div>
  ),
};
