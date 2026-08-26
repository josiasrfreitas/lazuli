import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, within } from "storybook/test";

import { Stepper, type StepperItem } from "@lazuli/ui";

const meta = {
  title: "Components/Stepper",
  component: Stepper,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Indicador horizontal de etapas para wizards. Apresentacional: renderiza a posição informada pelo chamador e nunca navega sozinho.",
      },
    },
  },
} satisfies Meta<typeof Stepper>;

export default meta;

type Story = StoryObj<typeof meta>;

const stateAttribute = "data-state";

const wizardSteps: StepperItem[] = [
  { label: "Dados" },
  { label: "Turma" },
  { label: "Financeiro" },
];

export const Playground: Story = {
  args: { activeIndex: 1, steps: wizardSteps },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole("listitem");

    await expect(items[0]).toHaveAttribute(stateAttribute, "complete");
    await expect(items[1]).toHaveAttribute(stateAttribute, "current");
    await expect(items[1]).toHaveAttribute("aria-current", "step");
    await expect(items[2]).toHaveAttribute(stateAttribute, "pending");
  },
};

export const FirstStep: Story = {
  args: { activeIndex: 0, steps: wizardSteps },
};

export const AllComplete: Story = {
  args: { activeIndex: wizardSteps.length, steps: wizardSteps },
};

export const WithDisabledSteps: Story = {
  args: {
    activeIndex: 0,
    steps: [
      { label: "Dados" },
      { label: "Turma", disabled: true },
      { label: "Financeiro", disabled: true },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole("listitem");

    await expect(items[1]).toHaveAttribute(stateAttribute, "disabled");
    await expect(items[1]).toHaveAttribute("aria-disabled", "true");
  },
};
