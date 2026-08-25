import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ReactElement } from "react";
import { expect, userEvent, within } from "storybook/test";

import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@lazuli/ui";

const meta = {
  title: "Components/Dialog",
  component: DialogContent,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Modal composto e acessível para confirmar ações ou apresentar conteúdo que exige atenção.",
      },
    },
  },
} satisfies Meta<typeof DialogContent>;

export default meta;

type Story = StoryObj<typeof meta>;

const dialogTitle = "Novo contrato";

function DialogActions(): ReactElement {
  return (
    <DialogFooter>
      <DialogClose render={<Button variant="secondary">Cancelar</Button>} />
      <Button>Criar contrato</Button>
    </DialogFooter>
  );
}

function ContractDialog({
  defaultOpen = false,
  longContent = false,
}: {
  defaultOpen?: boolean;
  longContent?: boolean;
}): ReactElement {
  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger render={<Button>{dialogTitle}</Button>} />
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent closeLabel="Fechar diálogo">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              As parcelas serão geradas a partir da data de início escolhida.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="mt-5 grid gap-3 text-caption text-foreground">
            {longContent ? (
              Array.from({ length: 18 }, (_item, index) => (
                <p key={index}>
                  Informação complementar {index + 1}: confira os dados do pagador antes de
                  continuar.
                </p>
              ))
            ) : (
              <p>O contrato poderá ser revisado antes da confirmação final.</p>
            )}
          </DialogBody>
          <DialogActions />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

export const Playground: Story = {
  render: () => <ContractDialog />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: dialogTitle });

    await userEvent.click(trigger);

    const screen = within(canvasElement.ownerDocument.body);
    const dialog = screen.getByRole("dialog", { name: dialogTitle });
    const closeButton = screen.getByRole("button", { name: "Fechar diálogo" });

    await expect(dialog).toHaveAccessibleDescription(
      "As parcelas serão geradas a partir da data de início escolhida.",
    );
    await expect(closeButton).toHaveFocus();

    await userEvent.click(closeButton);
    await expect(screen.queryByRole("dialog", { name: dialogTitle })).not.toBeInTheDocument();
    await expect(trigger).toHaveFocus();

    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    await expect(screen.queryByRole("dialog", { name: dialogTitle })).not.toBeInTheDocument();
    await expect(trigger).toHaveFocus();
  },
};

export const States: Story = {
  render: () => <ContractDialog defaultOpen />,
};

export const LongContent: Story = {
  render: () => <ContractDialog defaultOpen longContent />,
};
