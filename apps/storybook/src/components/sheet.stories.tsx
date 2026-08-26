import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ReactElement } from "react";
import { expect, userEvent, within } from "storybook/test";

import {
  Button,
  Sheet,
  SheetBackdrop,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
  type SheetSize,
} from "@lazuli/ui";

const meta = {
  title: "Components/Sheet",
  component: SheetContent,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Painel lateral ancorado à direita para pré-visualizações que mantêm a página ao fundo. Foco preso, Esc fecha e o foco retorna ao gatilho.",
      },
    },
  },
} satisfies Meta<typeof SheetContent>;

export default meta;

type Story = StoryObj<typeof meta>;

const sheetTitle = "Detalhes do aluno";
const paragraphCount = 24;

function PreviewSheet({
  defaultOpen = false,
  size = "md",
}: {
  defaultOpen?: boolean;
  size?: SheetSize;
}): ReactElement {
  return (
    <Sheet defaultOpen={defaultOpen}>
      <SheetTrigger render={<Button variant="secondary">{sheetTitle}</Button>} />
      <SheetPortal>
        <SheetBackdrop />
        <SheetContent closeLabel="Fechar painel" size={size}>
          <SheetHeader>
            <SheetTitle>{sheetTitle}</SheetTitle>
            <SheetDescription>Situação de matrícula, frequência e financeiro.</SheetDescription>
          </SheetHeader>
          <SheetBody className="mt-5 grid gap-3 text-caption text-foreground">
            {Array.from({ length: paragraphCount }, (_item, index) => (
              <p key={index}>
                Registro {index + 1}: presença confirmada na turma do semestre corrente.
              </p>
            ))}
          </SheetBody>
        </SheetContent>
      </SheetPortal>
    </Sheet>
  );
}

export const Playground: Story = {
  render: () => <PreviewSheet />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: sheetTitle });

    await userEvent.click(trigger);

    const screen = within(canvasElement.ownerDocument.body);
    const panel = screen.getByRole("dialog", { name: sheetTitle });

    await expect(panel).toHaveAttribute("data-slot", "sheet-content");
    await expect(screen.getByRole("button", { name: "Fechar painel" })).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    await expect(screen.queryByRole("dialog", { name: sheetTitle })).not.toBeInTheDocument();
    await expect(trigger).toHaveFocus();
  },
};

export const LongContent: Story = {
  render: () => <PreviewSheet defaultOpen />,
};

export const Wide: Story = {
  render: () => <PreviewSheet defaultOpen size="lg" />,
};
