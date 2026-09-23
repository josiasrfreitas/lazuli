import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState, type ReactElement } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import {
  Button,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
  type PopoverSize,
} from "@lazuli/ui";
import { SlidersHorizontal } from "lucide-react";

const meta = {
  title: "Components/Popover",
  component: PopoverContent,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Painel ancorado ao gatilho, para conteúdo secundário e formulários curtos. Use Dialog quando a tarefa precisa interromper a página e Tooltip para uma descrição passiva.",
      },
    },
  },
} satisfies Meta<typeof PopoverContent>;

export default meta;

type Story = StoryObj<typeof meta>;

function FilterPanel(): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <PopoverTitle>Filtrar contratos</PopoverTitle>
        <PopoverDescription>
          Escolha o período e a situação dos contratos listados.
        </PopoverDescription>
      </div>
      <div className="flex justify-end gap-2">
        <PopoverClose
          render={
            <Button size="sm" variant="ghost">
              Cancelar
            </Button>
          }
        />
        <PopoverClose
          render={
            <Button size="sm" variant="primary">
              Aplicar
            </Button>
          }
        />
      </div>
    </div>
  );
}

function FilterPopover({
  disabled = false,
  showArrow = true,
  side = "bottom",
  size = "md",
  triggerLabel = "Filtros",
}: {
  disabled?: boolean;
  showArrow?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  size?: PopoverSize;
  triggerLabel?: string;
}): ReactElement {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button disabled={disabled} variant="secondary">
            <SlidersHorizontal aria-hidden="true" />
            {triggerLabel}
          </Button>
        }
      />
      <PopoverContent showArrow={showArrow} side={side} size={size}>
        <FilterPanel />
      </PopoverContent>
    </Popover>
  );
}

export const Playground: Story = {
  render: () => <FilterPopover />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const screen = within(canvasElement.ownerDocument.body);

    await userEvent.click(canvas.getByRole("button", { name: "Filtros" }));

    // Assert on content rather than visibility: the panel is still at
    // `opacity: 0` while its entry animation runs.
    const panel = await screen.findByRole("dialog");
    await expect(panel).toHaveTextContent("Filtrar contratos");

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4 p-8">
      <FilterPopover size="sm" triggerLabel="Pequeno" />
      <FilterPopover size="md" triggerLabel="Médio" />
      <FilterPopover size="lg" triggerLabel="Grande" />
    </div>
  ),
};

export const Positions: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-12 p-16">
      <div className="justify-self-center">
        <FilterPopover side="top" triggerLabel="Acima" />
      </div>
      <div className="justify-self-center">
        <FilterPopover side="right" triggerLabel="À direita" />
      </div>
      <div className="justify-self-center">
        <FilterPopover side="left" triggerLabel="À esquerda" />
      </div>
      <div className="justify-self-center">
        <FilterPopover side="bottom" triggerLabel="Abaixo" />
      </div>
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4 p-8">
      <FilterPopover triggerLabel="Padrão" />
      <FilterPopover showArrow={false} triggerLabel="Sem seta" />
      <FilterPopover disabled triggerLabel="Indisponível" />
    </div>
  ),
};

function TallPopover(): ReactElement {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="min-h-[180vh] bg-background px-6 pt-[80vh]">
      <Popover>
        <PopoverTrigger render={<Button variant="secondary">Open stress popover</Button>} />
        <PopoverContent
          aria-label="Stress popover"
          align="end"
          className="w-[min(24rem,calc(100vw-2rem))] p-2"
        >
          <div className="scrollbar-subtle max-h-[min(70vh,calc(var(--available-height)-2.5rem))] space-y-3 overflow-y-auto p-2 pr-3">
            {Array.from({ length: 14 }, (_unused, index) => (
              <Button
                key={index}
                aria-pressed={selected === index}
                className="w-full"
                onClick={() => setSelected(index)}
                variant="ghost"
              >
                Opção {index + 1}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const ResponsiveStress: Story = {
  render: () => <TallPopover />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Open stress popover" });
    trigger.scrollIntoView({ block: "center" });
    await userEvent.click(trigger);
    const popup = await within(canvasElement.ownerDocument.body).findByRole("dialog", {
      name: "Stress popover",
    });
    const positioner = popup.closest<HTMLElement>('[data-slot="popover-positioner"]');
    await expect(positioner?.dataset.side).toMatch(/^(top|bottom)$/u);
    const bounds = popup.getBoundingClientRect();
    await expect(bounds.top).toBeGreaterThanOrEqual(0);
    await expect(bounds.bottom).toBeLessThanOrEqual(
      popup.ownerDocument.defaultView?.innerHeight ?? 0,
    );
    const lastOption = within(popup).getByRole("button", { name: "Opção 14" });
    await userEvent.click(lastOption);
    await expect(lastOption).toHaveAttribute("aria-pressed", "true");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(popup).not.toBeInTheDocument());
    await expect(trigger).toHaveFocus();
  },
};
