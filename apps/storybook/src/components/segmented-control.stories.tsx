import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState, type ReactElement } from "react";
import { expect, userEvent, within } from "storybook/test";

import { SegmentedControl, SegmentedControlItem } from "@lazuli/ui";

const GROUP_LABEL = "Tipo do documento";
const PRESSED = "aria-pressed";

const meta = {
  title: "Components/SegmentedControl",
  component: SegmentedControl,
  tags: ["autodocs"],
  argTypes: { wrap: { control: "boolean" } },
  parameters: {
    docs: {
      description: {
        component:
          "Inline single choice for up to five options where a dropdown would cost extra clicks. One Tab stop; arrow keys move between items and pressing the selected item again clears it. Name the group with `aria-label` or `aria-labelledby`.",
      },
    },
  },
} satisfies Meta<typeof SegmentedControl>;

export default meta;

type Story = StoryObj<typeof meta>;

function DocumentTypeExample({
  disabled = false,
  invalid = false,
  size,
}: {
  disabled?: boolean;
  invalid?: boolean;
  size?: "sm" | "md";
}): ReactElement {
  const [value, setValue] = useState<string | null>(null);

  return (
    <SegmentedControl
      aria-label={GROUP_LABEL}
      disabled={disabled}
      invalid={invalid}
      onValueChange={setValue}
      value={value}
      {...(size === undefined ? {} : { size })}
    >
      <SegmentedControlItem value="CPF">CPF</SegmentedControlItem>
      <SegmentedControlItem value="RG">RG</SegmentedControlItem>
    </SegmentedControl>
  );
}

export const Playground: Story = {
  args: { value: null, onValueChange: () => {} },
  render: () => <DocumentTypeExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole("group", { name: GROUP_LABEL });
    const cpf = within(group).getByRole("button", { name: "CPF" });
    const rg = within(group).getByRole("button", { name: "RG" });

    await userEvent.click(cpf);
    await expect(cpf).toHaveAttribute(PRESSED, "true");

    await userEvent.keyboard("{ArrowRight}");
    await expect(rg).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(rg).toHaveAttribute(PRESSED, "true");
    await expect(cpf).toHaveAttribute(PRESSED, "false");
  },
};

export const Sizes: Story = {
  args: { value: null, onValueChange: () => {} },
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <DocumentTypeExample size="sm" />
      <DocumentTypeExample size="md" />
    </div>
  ),
};

export const States: Story = {
  args: { value: null, onValueChange: () => {} },
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <DocumentTypeExample />
      <DocumentTypeExample invalid />
      <DocumentTypeExample disabled />
    </div>
  ),
};

export const Wrapped: Story = {
  args: { value: "review", onValueChange: () => {} },
  render: (args) => (
    <div className="w-48">
      <SegmentedControl {...args} size="sm" wrap aria-label="Activity kind">
        <SegmentedControlItem value="content">Content</SegmentedControlItem>
        <SegmentedControlItem value="review">Review</SegmentedControlItem>
        <SegmentedControlItem value="assessment">Assessment</SegmentedControlItem>
        <SegmentedControlItem value="activity">Activity</SegmentedControlItem>
      </SegmentedControl>
    </div>
  ),
};

export const WrappedChoices: Story = {
  args: { value: "makeup", onValueChange: () => {}, wrap: true, size: "sm" },
  render: (args) => (
    <div className="w-64">
      <SegmentedControl {...args} aria-label="Appointment purpose">
        <SegmentedControlItem value="makeup">Absence replacement</SegmentedControlItem>
        <SegmentedControlItem value="support">Academic support</SegmentedControlItem>
        <SegmentedControlItem value="assessment">Assessment</SegmentedControlItem>
      </SegmentedControl>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole("group", { name: "Appointment purpose" });
    const first = within(group).getByRole("button", { name: "Absence replacement" });
    const last = within(group).getByRole("button", { name: "Assessment" });
    await expect(last.getBoundingClientRect().top).toBeGreaterThan(
      first.getBoundingClientRect().top,
    );
    await expect(group.scrollWidth).toBeLessThanOrEqual(group.clientWidth);
    await userEvent.click(first);
    await userEvent.keyboard("{ArrowRight}");
    await expect(within(group).getByRole("button", { name: "Academic support" })).toHaveFocus();
  },
};
