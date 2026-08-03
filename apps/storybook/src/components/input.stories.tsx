import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, userEvent, within } from "storybook/test";

import { Input } from "@lazuli/ui";

const meta = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs"],
  args: {
    placeholder: "Enter a value",
    type: "text",
  },
  argTypes: {
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

export const Themes: Story = {
  parameters: { backgrounds: { disable: true } },
  render: () => (
    <div className="grid overflow-hidden rounded-lg border md:grid-cols-2">
      {[
        { label: "Light theme", theme: "light" },
        { label: "Dark theme", theme: "dark" },
      ].map(({ label, theme }) => (
        <section className={`${theme} bg-background p-5 text-foreground`} key={theme}>
          <h2 className="mb-4 font-display text-caption font-semibold">{label}</h2>
          <Input aria-label={`${label} student name`} defaultValue="Ana Souza" />
        </section>
      ))}
    </div>
  ),
};
