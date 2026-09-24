import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState, type ReactElement } from "react";
import { expect, userEvent, within } from "storybook/test";

import { CurrencyInput, Input } from "@lazuli/ui";

const meta = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs"],
  args: {
    placeholder: "Enter a value",
    type: "text",
  },
  argTypes: {
    size: { control: "select", options: ["xs", "sm", "md", "lg"] },
    invalid: { control: "boolean" },
    type: {
      control: "select",
      options: ["text", "email", "tel", "search"],
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Base text control with native input props and semantic invalid, disabled, read-only, and focus-visible states. Pair it with a label before use in a form.",
      },
    },
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <label className="grid w-full max-w-sm gap-2 text-caption font-medium">
      Student name
      <Input {...args} />
    </label>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Student name" });

    await userEvent.click(input);
    await expect(input).toHaveFocus();
  },
};

export const Types: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-3">
      <Input aria-label="Full name" placeholder="Full name" />
      <Input aria-label="Email address" placeholder="Email address" type="email" />
      <Input aria-label="Phone number" placeholder="Phone number" type="tel" />
      <Input aria-label="Search students" placeholder="Search students" type="search" />
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-3">
      <Input aria-label="Empty value" placeholder="Empty value" />
      <Input aria-label="Filled value" defaultValue="Ana Souza" />
      <Input aria-label="Invalid value" defaultValue="ana@" invalid type="email" />
      <Input aria-label="Disabled value" disabled placeholder="Disabled value" />
      <Input aria-label="Read-only value" defaultValue="Student ID: 2026-001" readOnly />
    </div>
  ),
};

export const Compact: Story = {
  args: { size: "xs", inputMode: "decimal", placeholder: "250,00" },
  render: (args) => (
    <label className="grid max-w-36 gap-1 text-caption">
      Amount (BRL)
      <Input {...args} />
    </label>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Short numeric settings: 28px high on desktop, 44px below 640px for touch input. Labels and units remain visible when the field is filled.",
      },
    },
  },
};

function FormattedExample(): ReactElement {
  const [cents, setCents] = useState<number | null>(null);
  return (
    <div className="grid w-full max-w-sm gap-2">
      <label className="grid gap-1 text-caption font-medium">
        Valor
        <CurrencyInput value={cents} onValueChange={setCents} />
      </label>
      <p className="text-caption text-muted-foreground" role="status">
        Valor controlado:{" "}
        {cents === null ? "vazio" : `${cents} ${cents === 1 ? "centavo" : "centavos"}`}
      </p>
    </div>
  );
}

export const Formatted: Story = {
  render: () => <FormattedExample />,
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "CurrencyInput é um input financeiro reutilizável em reais. Seu valor controlado é um inteiro em centavos; digitar 1 mostra R$ 0,01.",
      },
    },
  },
};
