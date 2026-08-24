import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ReactElement } from "react";
import { expect, userEvent, within } from "storybook/test";

import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@lazuli/ui";
import { CircleHelp } from "lucide-react";

const meta = {
  title: "Components/Tooltip",
  component: TooltipContent,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Descrição breve e não essencial de um controle. Não use tooltip como único meio de explicar uma ação necessária.",
      },
    },
  },
} satisfies Meta<typeof TooltipContent>;

export default meta;

type Story = StoryObj<typeof meta>;

function HelpTooltip({
  side = "top",
}: {
  side?: "top" | "right" | "bottom" | "left";
}): ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label="Ajuda sobre responsável financeiro"
        delay={0}
        render={
          <Button size="icon-sm" variant="ghost">
            <CircleHelp aria-hidden="true" />
          </Button>
        }
      />
      <TooltipContent side={side}>Pessoa responsável pelos pagamentos do aluno.</TooltipContent>
    </Tooltip>
  );
}

export const Playground: Story = {
  render: () => <HelpTooltip />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Ajuda sobre responsável financeiro" });

    await userEvent.hover(trigger);

    const screen = within(canvasElement.ownerDocument.body);
    await expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Pessoa responsável pelos pagamentos do aluno.",
    );
  },
};

export const Positions: Story = {
  render: () => (
    <TooltipProvider delay={0}>
      <div className="grid grid-cols-2 gap-12 p-16">
        <div className="justify-self-center">
          <HelpTooltip side="top" />
        </div>
        <div className="justify-self-center">
          <HelpTooltip side="right" />
        </div>
        <div className="justify-self-center">
          <HelpTooltip side="left" />
        </div>
        <div className="justify-self-center">
          <HelpTooltip side="bottom" />
        </div>
      </div>
    </TooltipProvider>
  ),
};

export const States: Story = {
  render: () => (
    <TooltipProvider delay={0}>
      <div className="flex flex-wrap items-center gap-4 p-8">
        <HelpTooltip />
        <Tooltip disabled>
          <TooltipTrigger
            aria-label="Ajuda indisponível"
            render={
              <Button disabled size="icon-sm" variant="ghost">
                <CircleHelp aria-hidden="true" />
              </Button>
            }
          />
          <TooltipContent>Este balão não é exibido para controles indisponíveis.</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
};
